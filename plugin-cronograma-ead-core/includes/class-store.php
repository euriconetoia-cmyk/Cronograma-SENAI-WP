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
		foreach ( $out['cursos'] as $c ) {
			if ( ! is_array( $c ) || empty( $c['id'] ) || ! self::valid_id( $c['id'] ) || ! isset( $c['modulos'] ) || ! is_array( $c['modulos'] ) ) {
				return new WP_Error( 'cronograma_ead_invalido', 'Curso com estrutura inválida.', array( 'status' => 400 ) );
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
		$allowed = array( 'id', 'cursoId', 'nome', 'unidadeId', 'inicio', 'fimManual', 'cursoSolicitado', 'evento', 'monitorId', 'tutorId', 'coordId', 'profId', 'ambiente', 'obs', 'itens', 'status', 'versao', 'rev', 'prazo', 'vigente' );
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
		$t['itens'] = array();
		$in_itens = isset( $input['itens'] ) && is_array( $input['itens'] ) ? $input['itens'] : array();
		if ( count( $in_itens ) > 500 ) {
			return new WP_Error( 'cronograma_ead_grande', 'Quantidade excessiva de etapas na turma.', array( 'status' => 413 ) );
		}
		$item_allowed = array( 'enc', 'rec', 'evento', 'monitorId', 'tutorId', 'coordId', 'profId', 'ambiente', 'scorm', 'apostila', 'aval', 'pesq', 'media', 'idm' );
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
			if ( isset( $it['enc'] ) ) {
				if ( ! is_array( $it['enc'] ) || count( $it['enc'] ) > 40 ) {
					return new WP_Error( 'cronograma_ead_grande', "Encontros em excesso na etapa $id.", array( 'status' => 413 ) );
				}
				foreach ( $it['enc'] as $enc ) {
					if ( ! is_array( $enc ) ) {
						return new WP_Error( 'cronograma_ead_invalido', "Encontro inválido na etapa $id.", array( 'status' => 400 ) );
					}
					$d = isset( $enc['d'] ) ? sanitize_text_field( (string) $enc['d'] ) : '';
					if ( '' !== $d && ! Cronograma_EAD_Rules::data_ok( $d ) ) {
						return new WP_Error( 'cronograma_ead_invalido', "Data de encontro inválida na etapa $id.", array( 'status' => 400 ) );
					}
				}
				$clean_item['enc'] = Cronograma_EAD_Rules::limpar_enc( $it['enc'] );
			}
			$t['itens'][ $id ] = $clean_item;
		}
		return $t;
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

	public static function seed_if_empty() {
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
