<?php
/**
 * Catálogo do sistema: cursos, equipe, feriados e unidades escolares.
 *
 * Fica em uma opção do WordPress, como texto JSON. Cada gravação sobe um número de
 * revisão ("rev"); quem tenta salvar com revisão antiga recebe conflito (HTTP 409).
 * As turmas ficam em tabela própria (veja class-db.php).
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Cronograma_EAD_Store {

	const OPT_DATA  = 'cronograma_ead_data';
	const OPT_REV   = 'cronograma_ead_rev';
	const MAX_BYTES = 2097152; // 2 MB.

	/** @return array{data:array,rev:int} */
	public static function get() {
		$raw  = get_option( self::OPT_DATA, '' );
		$data = is_string( $raw ) && '' !== $raw ? json_decode( $raw, true ) : null;
		if ( ! is_array( $data ) ) {
			$data = self::empty_data();
		}
		foreach ( array( 'cursos', 'pessoas', 'feriados', 'unidades' ) as $k ) {
			if ( ! isset( $data[ $k ] ) || ! is_array( $data[ $k ] ) ) {
				$data[ $k ] = array();
			}
		}
		return array(
			'data' => $data,
			'rev'  => (int) get_option( self::OPT_REV, 0 ),
		);
	}

	public static function empty_data() {
		return array( 'cursos' => array(), 'pessoas' => array(), 'feriados' => array(), 'unidades' => array() );
	}

	/**
	 * Grava o catálogo se a revisão enviada for a atual.
	 *
	 * @param mixed $input Dados decodificados.
	 * @param int   $rev   Revisão que o cliente tinha.
	 * @return array{rev:int}|WP_Error
	 */
	public static function save( $input, $rev ) {
		$clean = self::sanitize_payload( $input );
		if ( is_wp_error( $clean ) ) {
			return $clean;
		}
		$json = wp_json_encode( $clean );
		if ( false === $json || strlen( $json ) > self::MAX_BYTES ) {
			return new WP_Error( 'cronograma_ead_grande', 'Os dados são grandes demais para salvar.', array( 'status' => 413 ) );
		}
		if ( get_transient( 'cronograma_ead_lock' ) ) {
			return new WP_Error( 'cronograma_ead_ocupado', 'Outra gravação está em andamento. Tente de novo.', array( 'status' => 503 ) );
		}
		set_transient( 'cronograma_ead_lock', 1, 10 );

		$current = (int) get_option( self::OPT_REV, 0 );
		if ( (int) $rev !== $current ) {
			delete_transient( 'cronograma_ead_lock' );
			return new WP_Error( 'cronograma_ead_conflito', 'Os dados foram alterados por outra pessoa.', array( 'status' => 409, 'rev' => $current ) );
		}
		update_option( self::OPT_DATA, $json, false );
		$new = $current + 1;
		update_option( self::OPT_REV, $new, false );
		delete_transient( 'cronograma_ead_lock' );
		return array( 'rev' => $new );
	}

	/** Restaura exatamente um snapshot interno do catálogo após falha transacional. */
	public static function restore_snapshot( $snapshot ) {
		if ( ! is_array( $snapshot ) || ! isset( $snapshot['data'], $snapshot['rev'] ) || ! is_array( $snapshot['data'] ) ) {
			return false;
		}
		$json = wp_json_encode( $snapshot['data'] );
		if ( false === $json || strlen( $json ) > self::MAX_BYTES ) {
			return false;
		}
		// O rollback SQL não desfaz automaticamente o cache de options do WordPress.
		// Releia os valores persistidos antes de tentar restaurar o snapshot.
		wp_cache_delete( self::OPT_DATA, 'options' );
		wp_cache_delete( self::OPT_REV, 'options' );
		wp_cache_delete( 'alloptions', 'options' );
		update_option( self::OPT_DATA, $json, false );
		update_option( self::OPT_REV, (int) $snapshot['rev'], false );
		wp_cache_delete( self::OPT_DATA, 'options' );
		wp_cache_delete( self::OPT_REV, 'options' );
		wp_cache_delete( 'alloptions', 'options' );
		delete_transient( 'cronograma_ead_lock' );
		$restored = self::get();
		return $restored['rev'] === (int) $snapshot['rev'] && $restored['data'] === $snapshot['data'];
	}

	/** Valida a estrutura do catálogo e limpa todos os textos. */
	public static function sanitize_payload( $input ) {
		if ( is_object( $input ) ) {
			$input = json_decode( wp_json_encode( $input ), true );
		}
		if ( ! is_array( $input ) ) {
			return new WP_Error( 'cronograma_ead_invalido', 'Formato de dados inválido.', array( 'status' => 400 ) );
		}
		$out = array();
		foreach ( array( 'cursos', 'pessoas', 'feriados', 'unidades' ) as $k ) {
			if ( ! isset( $input[ $k ] ) ) {
				if ( 'unidades' === $k ) {
					$out[ $k ] = array();
					continue;
				}
				return new WP_Error( 'cronograma_ead_invalido', "Campo ausente ou inválido: $k.", array( 'status' => 400 ) );
			}
			if ( ! is_array( $input[ $k ] ) ) {
				return new WP_Error( 'cronograma_ead_invalido', "Campo ausente ou inválido: $k.", array( 'status' => 400 ) );
			}
			$out[ $k ] = array_values( self::clean( $input[ $k ] ) );
		}
		foreach ( $out['cursos'] as $i => $curso ) {
			if ( isset( $curso['modalidade'] ) && 'presencial' === $curso['modalidade'] ) {
				$out['cursos'][ $i ]['modalidade'] = 'semipresencial';
			}
			if ( isset( $out['cursos'][ $i ]['modalidade'] ) && '' !== $out['cursos'][ $i ]['modalidade'] && ! in_array( $out['cursos'][ $i ]['modalidade'], array( 'ead', 'semipresencial' ), true ) ) {
				return new WP_Error( 'cronograma_ead_invalido', 'Modalidade inválida. Use EaD ou Semipresencial / Híbrido.', array( 'status' => 400 ) );
			}
		}
		$ufs = array( 'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO' );
		foreach ( $out['unidades'] as $i => $unidade ) {
			$estado = isset( $unidade['estado'] ) ? strtoupper( trim( (string) $unidade['estado'] ) ) : '';
			$cidade = isset( $unidade['cidade'] ) ? trim( (string) $unidade['cidade'] ) : '';
			if ( ! in_array( $estado, $ufs, true ) ) {
				return new WP_Error( 'cronograma_ead_invalido', 'Estado inválido no cadastro da unidade.', array( 'status' => 400 ) );
			}
			if ( '' === $cidade ) {
				return new WP_Error( 'cronograma_ead_invalido', 'Informe a cidade da unidade.', array( 'status' => 400 ) );
			}
			$out['unidades'][ $i ]['estado'] = $estado;
			$out['unidades'][ $i ]['cidade'] = $cidade;
			if ( isset( $unidade['codigoIbge'] ) && '' !== (string) $unidade['codigoIbge'] ) {
				$ibge = preg_replace( '/\D+/', '', (string) $unidade['codigoIbge'] );
				if ( ! preg_match( '/^\d{7}$/', $ibge ) ) {
					return new WP_Error( 'cronograma_ead_invalido', 'Código IBGE inválido no cadastro da unidade.', array( 'status' => 400 ) );
				}
				$out['unidades'][ $i ]['codigoIbge'] = $ibge;
			}
		}

		foreach ( $out['cursos'] as $c ) {
			if ( ! is_array( $c ) || empty( $c['id'] ) || ! self::valid_id( $c['id'] ) || ! isset( $c['modulos'] ) || ! is_array( $c['modulos'] ) ) {
				return new WP_Error( 'cronograma_ead_invalido', 'Curso com estrutura inválida.', array( 'status' => 400 ) );
			}
			$modelos = array( 'tecnico', 'qualificacao', 'distribuicao_diaria', 'aprendizagem', 'personalizado' );
			if ( isset( $c['modeloCronograma'] ) && '' !== $c['modeloCronograma'] && ! in_array( $c['modeloCronograma'], $modelos, true ) ) {
				return new WP_Error( 'cronograma_ead_invalido', 'Modelo de cronograma inválido.', array( 'status' => 400 ) );
			}
			$cfg = isset( $c['configuracaoCronograma'] ) && is_array( $c['configuracaoCronograma'] ) ? $c['configuracaoCronograma'] : array();
			foreach ( array( 'diasEstudoPermitidos' ) as $campo_dias ) {
				if ( isset( $cfg[ $campo_dias ] ) && ! self::dias_semana_validos( $cfg[ $campo_dias ] ) ) {
					return new WP_Error( 'cronograma_ead_invalido', 'Dias permitidos inválidos no curso.', array( 'status' => 400 ) );
				}
			}
			foreach ( array( 'presencial', 'sincrono' ) as $tipo_evento ) {
				if ( isset( $cfg[ $tipo_evento ]['diasPermitidos'] ) && ! self::dias_semana_validos( $cfg[ $tipo_evento ]['diasPermitidos'] ) ) {
					return new WP_Error( 'cronograma_ead_invalido', 'Dias permitidos inválidos em ' . $tipo_evento . '.', array( 'status' => 400 ) );
				}
			}
			if ( isset( $cfg['aprendizagem'] ) && is_array( $cfg['aprendizagem'] ) ) {
				foreach ( array( 'diasIntensivos', 'diasAtendimentoRegular' ) as $campo_dias_aprendizagem ) {
					if ( isset( $cfg['aprendizagem'][ $campo_dias_aprendizagem ] ) && ! self::dias_semana_validos( $cfg['aprendizagem'][ $campo_dias_aprendizagem ] ) ) {
						return new WP_Error( 'cronograma_ead_invalido', 'Dias de atendimento inválidos na Aprendizagem.', array( 'status' => 400 ) );
					}
				}
			}
			foreach ( $c['modulos'] as $modulo ) {
				if ( ! is_array( $modulo ) || empty( $modulo['id'] ) || ! self::valid_id( $modulo['id'] ) || ! isset( $modulo['itens'] ) || ! is_array( $modulo['itens'] ) ) {
					return new WP_Error( 'cronograma_ead_invalido', 'Módulo com estrutura inválida.', array( 'status' => 400 ) );
				}
				foreach ( $modulo['itens'] as $item ) {
					if ( ! is_array( $item ) || empty( $item['id'] ) || ! self::valid_id( $item['id'] ) || ! isset( $item['tipo'] ) || ! in_array( $item['tipo'], array( 'intro', 'uc', 'rec', 'mat', 'pratica' ), true ) ) {
						return new WP_Error( 'cronograma_ead_invalido', 'Etapa de curso inválida.', array( 'status' => 400 ) );
					}
					$item_cfg = isset( $item['configuracaoCronograma'] ) && is_array( $item['configuracaoCronograma'] ) ? $item['configuracaoCronograma'] : array();
					foreach ( array( 'presencial', 'sincrono' ) as $tipo_evento ) {
						if ( isset( $item_cfg[ $tipo_evento ]['diasPermitidos'] ) && ! self::dias_semana_validos( $item_cfg[ $tipo_evento ]['diasPermitidos'] ) ) {
							return new WP_Error( 'cronograma_ead_invalido', 'Dias permitidos inválidos na etapa.', array( 'status' => 400 ) );
						}
					}
				}
			}
		}
		foreach ( array( 'pessoas', 'unidades' ) as $k ) {
			foreach ( $out[ $k ] as $p ) {
				if ( ! is_array( $p ) || empty( $p['id'] ) || ! self::valid_id( $p['id'] ) ) {
					return new WP_Error( 'cronograma_ead_invalido', ( 'pessoas' === $k ? 'Pessoa' : 'Unidade' ) . ' com estrutura inválida.', array( 'status' => 400 ) );
				}
			}
		}
		foreach ( $out['feriados'] as $i => $f ) {
			if ( ! is_array( $f ) || ! isset( $f[0] ) || ! Cronograma_EAD_Rules::data_ok( (string) $f[0] ) ) {
				return new WP_Error( 'cronograma_ead_invalido', 'Feriado com data inválida (use AAAA-MM-DD).', array( 'status' => 400 ) );
			}
			$out['feriados'][ $i ] = array_values( $f );
		}
		return $out;
	}

	/** Valida a estrutura de uma turma segundo contrato explícito. */
	public static function sanitize_turma( $input ) {
		if ( is_object( $input ) ) {
			$input = json_decode( wp_json_encode( $input ), true );
		}
		if ( ! is_array( $input ) ) {
			return new WP_Error( 'cronograma_ead_invalido', 'Turma inválida.', array( 'status' => 400 ) );
		}
		$raw = wp_json_encode( $input );
		if ( false === $raw || strlen( $raw ) > 262144 ) {
			return new WP_Error( 'cronograma_ead_grande', 'Os dados da turma excedem o limite de 256 KB.', array( 'status' => 413 ) );
		}
		$allowed = array( 'id', 'cursoId', 'nome', 'unidadeId', 'inicio', 'fimManual', 'cursoSolicitado', 'evento', 'monitorId', 'tutorId', 'coordId', 'profId', 'ambiente', 'obs', 'itens', 'status', 'versao', 'rev', 'prazo', 'vigente', 'personalizarCronograma', 'configuracaoCronograma' );
		foreach ( array_keys( $input ) as $k ) {
			if ( ! in_array( (string) $k, $allowed, true ) ) {
				return new WP_Error( 'cronograma_ead_campo', 'Campo de turma não permitido: ' . sanitize_text_field( (string) $k ) . '.', array( 'status' => 400 ) );
			}
		}
		$t = array();
		$limits = array(
			'id' => 64, 'cursoId' => 64, 'nome' => 160, 'unidadeId' => 64, 'inicio' => 10, 'fimManual' => 10,
			'cursoSolicitado' => 160, 'evento' => 190, 'monitorId' => 64, 'tutorId' => 64, 'coordId' => 64,
			'profId' => 64, 'ambiente' => 190, 'obs' => 2000,
		);
		foreach ( $limits as $k => $max ) {
			if ( array_key_exists( $k, $input ) ) {
				$v = is_scalar( $input[ $k ] ) ? sanitize_text_field( (string) $input[ $k ] ) : '';
				if ( function_exists( 'mb_strlen' ) ? mb_strlen( $v ) > $max : strlen( $v ) > $max ) {
					return new WP_Error( 'cronograma_ead_tamanho', "Campo $k excede o limite permitido.", array( 'status' => 422 ) );
				}
				$t[ $k ] = $v;
			}
		}
		if ( empty( $t['id'] ) || ! self::valid_id( $t['id'] ) ) {
			return new WP_Error( 'cronograma_ead_invalido', 'Turma sem identificação válida.', array( 'status' => 400 ) );
		}
		foreach ( array( 'cursoId', 'unidadeId', 'monitorId', 'tutorId', 'coordId', 'profId' ) as $k ) {
			if ( isset( $t[ $k ] ) && '' !== $t[ $k ] && ! self::valid_id( $t[ $k ] ) ) {
				return new WP_Error( 'cronograma_ead_invalido', "Campo inválido: $k.", array( 'status' => 400 ) );
			}
		}
		foreach ( array( 'inicio', 'fimManual' ) as $k ) {
			if ( isset( $t[ $k ] ) && '' !== $t[ $k ] && ! Cronograma_EAD_Rules::data_ok( $t[ $k ] ) ) {
				return new WP_Error( 'cronograma_ead_invalido', "Data inválida em $k (use AAAA-MM-DD).", array( 'status' => 400 ) );
			}
		}
		if ( isset( $input['status'] ) && in_array( (string) $input['status'], array( 'solicitado', 'elaboracao', 'validacao', 'validado', 'arquivado' ), true ) ) {
			$t['status'] = (string) $input['status'];
		}
		if ( isset( $input['versao'] ) ) {
			$t['versao'] = max( 1, (int) $input['versao'] );
		}
		if ( isset( $input['rev'] ) ) {
			$t['rev'] = max( 1, (int) $input['rev'] );
		}
		if ( isset( $input['prazo'] ) && '' !== (string) $input['prazo'] ) {
			$prazo = sanitize_text_field( (string) $input['prazo'] );
			if ( ! Cronograma_EAD_Rules::data_ok( $prazo ) ) {
				return new WP_Error( 'cronograma_ead_invalido', 'Prazo inválido na turma.', array( 'status' => 400 ) );
			}
			$t['prazo'] = $prazo;
		} elseif ( array_key_exists( 'prazo', $input ) ) {
			$t['prazo'] = '';
		}
		if ( isset( $input['vigente'] ) && is_array( $input['vigente'] ) ) {
			$t['vigente'] = self::clean( $input['vigente'] );
		} elseif ( array_key_exists( 'vigente', $input ) ) {
			$t['vigente'] = null;
		}
		$t['personalizarCronograma'] = ! empty( $input['personalizarCronograma'] );
		if ( isset( $input['configuracaoCronograma'] ) ) {
			if ( ! is_array( $input['configuracaoCronograma'] ) ) {
				return new WP_Error( 'cronograma_ead_invalido', 'Configuração de cronograma da turma inválida.', array( 'status' => 400 ) );
			}
			$cfg = self::clean( $input['configuracaoCronograma'] );
			$cfg_allowed = array( 'cargaDiaria', 'diasEstudoPermitidos', 'presencial', 'sincrono', 'praticaProfissional', 'aprendizagem' );
			foreach ( array_keys( $cfg ) as $cfg_key ) {
				if ( ! in_array( (string) $cfg_key, $cfg_allowed, true ) ) {
					return new WP_Error( 'cronograma_ead_campo', 'Configuração de turma não permitida: ' . sanitize_text_field( (string) $cfg_key ) . '.', array( 'status' => 400 ) );
				}
			}
			if ( isset( $cfg['diasEstudoPermitidos'] ) && ! self::dias_semana_validos( $cfg['diasEstudoPermitidos'] ) ) {
				return new WP_Error( 'cronograma_ead_invalido', 'Dias de estudo inválidos na turma.', array( 'status' => 400 ) );
			}
			foreach ( array( 'presencial', 'sincrono' ) as $tipo_evento ) {
				if ( isset( $cfg[ $tipo_evento ] ) && ! is_array( $cfg[ $tipo_evento ] ) ) {
					return new WP_Error( 'cronograma_ead_invalido', 'Regra de evento inválida na turma.', array( 'status' => 400 ) );
				}
				if ( isset( $cfg[ $tipo_evento ]['diasPermitidos'] ) && ! self::dias_semana_validos( $cfg[ $tipo_evento ]['diasPermitidos'] ) ) {
					return new WP_Error( 'cronograma_ead_invalido', 'Dias permitidos inválidos na turma.', array( 'status' => 400 ) );
				}
			}
			if ( isset( $cfg['aprendizagem'] ) ) {
				if ( ! is_array( $cfg['aprendizagem'] ) ) {
					return new WP_Error( 'cronograma_ead_invalido', 'Configuração de Aprendizagem da turma inválida.', array( 'status' => 400 ) );
				}
				foreach ( array( 'diasIntensivos', 'diasAtendimentoRegular' ) as $campo_dias ) {
					if ( isset( $cfg['aprendizagem'][ $campo_dias ] ) && ! self::dias_semana_validos( $cfg['aprendizagem'][ $campo_dias ] ) ) {
						return new WP_Error( 'cronograma_ead_invalido', 'Dias de Aprendizagem inválidos na turma.', array( 'status' => 400 ) );
					}
				}
			}
			$t['configuracaoCronograma'] = $cfg;
		}

		$t['itens'] = array();
		$in_itens = isset( $input['itens'] ) && is_array( $input['itens'] ) ? $input['itens'] : array();
		if ( count( $in_itens ) > 500 ) {
			return new WP_Error( 'cronograma_ead_grande', 'Quantidade excessiva de etapas na turma.', array( 'status' => 413 ) );
		}
		$item_allowed = array( 'enc', 'sin', 'eventos', 'rec', 'evento', 'monitorId', 'tutorId', 'coordId', 'profId', 'ambiente', 'scorm', 'apostila', 'aval', 'pesq', 'media', 'idm' );
		$item_limits = array( 'rec' => 2000, 'evento' => 190, 'monitorId' => 64, 'tutorId' => 64, 'coordId' => 64, 'profId' => 64, 'ambiente' => 190, 'scorm' => 190, 'apostila' => 190, 'aval' => 190, 'pesq' => 190, 'media' => 190, 'idm' => 190 );
		foreach ( $in_itens as $id => $it ) {
			$id = (string) $id;
			if ( ! self::valid_id( $id ) || ! is_array( $it ) ) {
				return new WP_Error( 'cronograma_ead_invalido', 'Etapa de turma inválida.', array( 'status' => 400 ) );
			}
			foreach ( array_keys( $it ) as $k ) {
				if ( ! in_array( (string) $k, $item_allowed, true ) ) {
					return new WP_Error( 'cronograma_ead_campo', "Campo não permitido na etapa $id: $k.", array( 'status' => 400 ) );
				}
			}
			$clean_item = array();
			foreach ( $item_limits as $k => $max ) {
				if ( array_key_exists( $k, $it ) ) {
					$v = is_scalar( $it[ $k ] ) ? sanitize_text_field( (string) $it[ $k ] ) : '';
					if ( function_exists( 'mb_strlen' ) ? mb_strlen( $v ) > $max : strlen( $v ) > $max ) {
						return new WP_Error( 'cronograma_ead_tamanho', "Campo $k da etapa $id excede o limite permitido.", array( 'status' => 422 ) );
					}
					$clean_item[ $k ] = $v;
				}
			}
			foreach ( array( 'enc' => 'Encontros', 'sin' => 'Momentos síncronos' ) as $campo_momento => $rotulo_momento ) {
				if ( ! isset( $it[ $campo_momento ] ) ) {
					continue;
				}
				if ( ! is_array( $it[ $campo_momento ] ) || count( $it[ $campo_momento ] ) > 40 ) {
					return new WP_Error( 'cronograma_ead_grande', "$rotulo_momento em excesso na etapa $id.", array( 'status' => 413 ) );
				}
				foreach ( $it[ $campo_momento ] as $momento ) {
					if ( ! is_array( $momento ) ) {
						return new WP_Error( 'cronograma_ead_invalido', "Momento inválido na etapa $id.", array( 'status' => 400 ) );
					}
					$d = isset( $momento['d'] ) ? sanitize_text_field( (string) $momento['d'] ) : '';
					if ( '' !== $d && ! Cronograma_EAD_Rules::data_ok( $d ) ) {
						return new WP_Error( 'cronograma_ead_invalido', "Data de momento inválida na etapa $id.", array( 'status' => 400 ) );
					}
				}
				$clean_item[ $campo_momento ] = Cronograma_EAD_Rules::limpar_enc( $it[ $campo_momento ] );
			}
			if ( isset( $it['eventos'] ) ) {
				if ( ! is_array( $it['eventos'] ) || count( $it['eventos'] ) > 100 ) {
					return new WP_Error( 'cronograma_ead_grande', "Eventos pedagógicos em excesso na etapa $id.", array( 'status' => 413 ) );
				}
				$tipos_evento = array( 'estudo_ava', 'sincrono', 'presencial', 'web_aula', 'atendimento', 'atividade', 'recuperacao', 'pratica_empresa', 'matricula', 'postagem_notas', 'inicio_curso', 'fim_curso', 'inicio_modulo', 'fim_modulo' );
				$eventos_limpos = array();
				foreach ( $it['eventos'] as $evento ) {
					if ( ! is_array( $evento ) ) {
						return new WP_Error( 'cronograma_ead_invalido', "Evento pedagógico inválido na etapa $id.", array( 'status' => 400 ) );
					}
					$tipo = isset( $evento['tipo'] ) ? sanitize_text_field( (string) $evento['tipo'] ) : '';
					if ( ! in_array( $tipo, $tipos_evento, true ) ) {
						return new WP_Error( 'cronograma_ead_invalido', "Tipo de evento pedagógico inválido na etapa $id.", array( 'status' => 400 ) );
					}
					$ev = array( 'tipo' => $tipo );
					foreach ( array( 'd', 'fim' ) as $campo_data ) {
						if ( isset( $evento[ $campo_data ] ) && '' !== (string) $evento[ $campo_data ] ) {
							$data_evento = sanitize_text_field( (string) $evento[ $campo_data ] );
							if ( ! Cronograma_EAD_Rules::data_ok( $data_evento ) ) {
								return new WP_Error( 'cronograma_ead_invalido', "Data de evento pedagógico inválida na etapa $id.", array( 'status' => 400 ) );
							}
							$ev[ $campo_data ] = $data_evento;
						}
					}
					foreach ( array( 'id', 'h', 'titulo', 'observacao' ) as $campo_texto ) {
						if ( isset( $evento[ $campo_texto ] ) ) {
							$ev[ $campo_texto ] = sanitize_text_field( (string) $evento[ $campo_texto ] );
						}
					}
					if ( isset( $evento['duracaoHoras'] ) ) {
						$duracao = (float) $evento['duracaoHoras'];
						if ( $duracao < 0 || $duracao > 24 ) {
							return new WP_Error( 'cronograma_ead_invalido', "Duração de evento pedagógico inválida na etapa $id.", array( 'status' => 400 ) );
						}
						$ev['duracaoHoras'] = $duracao;
					}
					$eventos_limpos[] = $ev;
				}
				$clean_item['eventos'] = $eventos_limpos;
			}
			$t['itens'][ $id ] = $clean_item;
		}
		return $t;
	}

	/** Valida dias da semana no padrão JS/PHP: 0=domingo até 6=sábado. */
	private static function dias_semana_validos( $dias ) {
		if ( ! is_array( $dias ) ) {
			return false;
		}
		foreach ( $dias as $dia ) {
			if ( ! is_int( $dia ) && ! ctype_digit( (string) $dia ) ) {
				return false;
			}
			$dia = (int) $dia;
			if ( $dia < 0 || $dia > 6 ) {
				return false;
			}
		}
		return true;
	}

	public static function valid_id( $id ) {
		return is_string( $id ) && (bool) preg_match( '/^[A-Za-z0-9_\-]{1,64}$/', $id );
	}

	/** Remove marcação HTML de todos os textos; mantém números, booleanos e a forma dos dados. */
	private static function clean( $value ) {
		if ( is_array( $value ) ) {
			$out = array();
			foreach ( $value as $k => $v ) {
				$key         = is_string( $k ) ? preg_replace( '/[^A-Za-z0-9_\-]/', '', $k ) : $k;
				$out[ $key ] = self::clean( $v );
			}
			return $out;
		}
		if ( is_string( $value ) ) {
			return sanitize_text_field( $value );
		}
		if ( is_int( $value ) || is_float( $value ) || is_bool( $value ) || null === $value ) {
			return $value;
		}
		return '';
	}

	/** Arquivo de exemplo (TST Itumbiara) como lista associativa, ou null. */
	public static function seed_data() {
		$file = CRONOGRAMA_EAD_DIR . 'data/seed.json';
		$json = file_exists( $file ) ? file_get_contents( $file ) : '';
		$data = json_decode( $json, true );
		return is_array( $data ) ? $data : null;
	}

	public static function limpar_cursos() {
		$cur = self::get();
		$data = $cur['data'];
		$data['cursos'] = array();
		update_option( self::OPT_DATA, wp_json_encode( $data ), false );
		update_option( self::OPT_REV, (int) $cur['rev'] + 1, false );
		update_option( 'cronograma_ead_seed_bloqueado', 1, false );
		return true;
	}

	public static function seed_if_empty() {
		if ( get_option( 'cronograma_ead_seed_bloqueado' ) ) {
			return;
		}
		$cur = self::get();
		if ( empty( $cur['data']['cursos'] ) && 0 === Cronograma_EAD_DB::contar() ) {
			self::seed();
		}
	}

	/** Grava os dados de exemplo, substituindo o catálogo e recolocando a turma de exemplo. */
	public static function seed() {
		$data = self::seed_data();
		if ( ! $data ) {
			return false;
		}
		$turmas = isset( $data['turmas'] ) && is_array( $data['turmas'] ) ? $data['turmas'] : array();
		unset( $data['turmas'] );
		$clean = self::sanitize_payload( $data );
		if ( is_wp_error( $clean ) ) {
			return false;
		}
		update_option( self::OPT_DATA, wp_json_encode( $clean ), false );
		update_option( self::OPT_REV, (int) get_option( self::OPT_REV, 0 ) + 1, false );
		foreach ( $turmas as $t ) {
			$t = self::sanitize_turma( $t );
			if ( is_wp_error( $t ) || Cronograma_EAD_DB::get( $t['id'] ) ) {
				continue;
			}
			Cronograma_EAD_DB::inserir( $t, Cronograma_EAD_Rules::S_ELABORACAO, 0 );
		}
		return true;
	}
}
