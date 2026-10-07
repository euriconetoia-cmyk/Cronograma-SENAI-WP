<?php
/**
 * Regras de negócio sobre o WordPress: quem vê o quê, gravação, transições, versões e histórico.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Cronograma_EAD_Service {

	/* ---------- perfil e vínculos ---------- */

	/** equipe (Unidigit@l) | unidade | consulta | '' */
	public static function perfil( $uid = 0 ) {
		$uid = $uid ? (int) $uid : get_current_user_id();
		if ( ! $uid || Cronograma_EAD_Accounts::inativo( $uid ) ) {
			return '';
		}
		if ( user_can( $uid, Cronograma_EAD_Roles::CAP_EDIT_TURMAS ) && ( user_can( $uid, Cronograma_EAD_Roles::CAP_CATALOG ) || user_can( $uid, Cronograma_EAD_Roles::CAP_VALIDATE_AS_UNIT ) ) ) {
			return 'equipe';
		}
		if ( user_can( $uid, Cronograma_EAD_Roles::CAP_EDIT_TURMAS ) ) {
			return 'unidade';
		}
		if ( user_can( $uid, Cronograma_EAD_Roles::CAP_VIEW ) ) {
			return 'consulta';
		}
		return '';
	}

	public static function unidades_do_usuario( $uid = 0 ) {
		$uid = $uid ? (int) $uid : get_current_user_id();
		$v   = get_user_meta( $uid, Cronograma_EAD_Users::META_UNIDADES, true );
		return is_array( $v ) ? array_values( array_filter( array_map( 'strval', $v ) ) ) : array();
	}

	public static function validador( $uid = 0 ) {
		$uid = $uid ? (int) $uid : get_current_user_id();
		return (bool) get_user_meta( $uid, Cronograma_EAD_Users::META_VALIDADOR, true );
	}

	/** @return array<string,mixed>|null  null = vê tudo */
	private static function escopo( $perfil ) {
		return 'equipe' === $perfil ? null : self::unidades_do_usuario();
	}

	private static function pode_ver( $row, $perfil ) {
		if ( 'equipe' === $perfil ) {
			return true;
		}
		return in_array( $perfil, array( 'unidade', 'consulta' ), true ) && in_array( $row->unidade_id, self::unidades_do_usuario(), true );
	}

	private static function erro( $codigo, $msg, $status = 400, $extra = array() ) {
		return new WP_Error( 'cronograma_ead_' . $codigo, $msg, array_merge( array( 'status' => $status ), $extra ) );
	}

	private static function msg_regra( $codigo ) {
		$m = array(
			'acao_invalida'       => 'Ação desconhecida.',
			'sem_permissao'       => 'Seu perfil não pode fazer esta ação.',
			'status_incompativel' => 'Esta ação não está disponível no status atual do cronograma.',
			'nao_validador'       => 'Só quem foi indicado como validador da unidade pode validar.',
			'motivo_obrigatorio'  => 'Escreva o motivo.',
		);
		return isset( $m[ $codigo ] ) ? $m[ $codigo ] : 'Ação não permitida.';
	}

	/* ---------- apresentação ---------- */

	public static function presentar( $row, $vigentes = null ) {
		$t = json_decode( $row->data, true );
		$t = is_array( $t ) ? $t : array();
		$t['id']        = $row->id;
		$t['unidadeId'] = $row->unidade_id;
		$t['status']    = $row->status;
		$t['versao']    = (int) $row->versao;
		$t['rev']       = (int) $row->rev;
		$t['prazo']     = $row->prazo ? $row->prazo : '';
		if ( null === $vigentes ) {
			$vigentes = Cronograma_EAD_DB::vigentes();
		}
		$t['vigente'] = null;
		if ( isset( $vigentes[ $row->id ] ) ) {
			$v            = $vigentes[ $row->id ];
			$t['vigente'] = array(
				'versao'   => (int) $v->versao,
				'por'      => $v->validado_nome,
				'em'       => $v->validado_em,
				'ressalva' => (string) $v->ressalva,
			);
		}
		return Cronograma_EAD_Rules::para_saida( $t );
	}

	private static function decodificar( $row ) {
		$t = json_decode( $row->data, true );
		$t = is_array( $t ) ? $t : array();
		$t['id']        = $row->id;
		$t['unidadeId'] = $row->unidade_id;
		return $t;
	}

	private static function ids_do_curso( $catalogo, $curso_id ) {
		foreach ( $catalogo['cursos'] as $c ) {
			if ( isset( $c['id'] ) && $c['id'] === $curso_id ) {
				$ids = array();
				foreach ( (array) $c['modulos'] as $m ) {
					foreach ( (array) ( isset( $m['itens'] ) ? $m['itens'] : array() ) as $it ) {
						if ( isset( $it['id'] ) ) {
							$ids[] = (string) $it['id'];
						}
					}
				}
				return $ids;
			}
		}
		return null;
	}


	private static function feriados_da_unidade( $catalogo, $unidade_id ) {
		return array_values(
			array_filter(
				isset( $catalogo['feriados'] ) && is_array( $catalogo['feriados'] ) ? $catalogo['feriados'] : array(),
				function ( $f ) use ( $unidade_id ) {
					return is_array( $f ) && isset( $f[0] ) && ( ! isset( $f[2] ) || '' === $f[2] || $f[2] === $unidade_id );
				}
			)
		);
	}

	private static function validar_referencias_turma( array $t, array $catalogo, $curso_obrigatorio = true ) {
		$units = array_column( isset( $catalogo['unidades'] ) ? $catalogo['unidades'] : array(), 'id' );
		if ( empty( $t['unidadeId'] ) || ! in_array( $t['unidadeId'], $units, true ) ) {
			return self::erro( 'unidade', 'A unidade informada não existe no catálogo.', 422 );
		}
		$curso_id = isset( $t['cursoId'] ) ? $t['cursoId'] : '';
		$item_ids = null;
		if ( '' !== $curso_id ) {
			$item_ids = self::ids_do_curso( $catalogo, $curso_id );
			if ( null === $item_ids ) {
				return self::erro( 'curso', 'O curso informado não existe no catálogo.', 422 );
			}
		} elseif ( $curso_obrigatorio ) {
			return self::erro( 'curso', 'Escolha um curso cadastrado.', 422 );
		}
		$pessoas = array_column( isset( $catalogo['pessoas'] ) ? $catalogo['pessoas'] : array(), 'id' );
		foreach ( array( 'monitorId', 'tutorId', 'coordId', 'profId' ) as $k ) {
			if ( ! empty( $t[ $k ] ) && ! in_array( $t[ $k ], $pessoas, true ) ) {
				return self::erro( 'pessoa', "Referência inválida em $k.", 422 );
			}
		}
		if ( isset( $t['itens'] ) && is_array( $t['itens'] ) ) {
			foreach ( $t['itens'] as $iid => $it ) {
				if ( null !== $item_ids && ! in_array( (string) $iid, $item_ids, true ) ) {
					return self::erro( 'item', 'A turma contém etapa que não pertence ao curso.', 422 );
				}
				foreach ( array( 'monitorId', 'tutorId', 'coordId', 'profId' ) as $k ) {
					if ( is_array( $it ) && ! empty( $it[ $k ] ) && ! in_array( $it[ $k ], $pessoas, true ) ) {
						return self::erro( 'pessoa', "Referência inválida em $k na etapa $iid.", 422 );
					}
				}
			}
		}
		return true;
	}

	/* ---------- bootstrap ---------- */

	public static function bootstrap() {
		$perfil = self::perfil();
		$uids   = self::unidades_do_usuario();
		$cat    = Cronograma_EAD_Store::get();
		$data   = $cat['data'];
		$rows   = Cronograma_EAD_DB::listar( self::escopo( $perfil ) );
		$vig    = Cronograma_EAD_DB::vigentes();
		$turmas = array();
		foreach ( $rows as $r ) {
			$turmas[] = self::presentar( $r, $vig );
		}
		if ( 'equipe' !== $perfil ) {
			$usados = array();
			foreach ( $turmas as $t ) {
				if ( ! empty( $t['cursoId'] ) ) {
					$usados[ $t['cursoId'] ] = true;
				}
			}
			// Para solicitar turma, a unidade escolhe entre todos os cursos (só o nome e o id).
			$todos_cursos = array();
			foreach ( $data['cursos'] as $c ) {
				$todos_cursos[] = isset( $usados[ $c['id'] ] ) ? $c : array( 'id' => $c['id'], 'nome' => isset( $c['nome'] ) ? $c['nome'] : '', 'categoria' => isset( $c['categoria'] ) ? $c['categoria'] : '', 'modalidade' => isset( $c['modalidade'] ) ? $c['modalidade'] : '', 'chTotal' => isset( $c['chTotal'] ) ? $c['chTotal'] : 0, 'nota' => '', 'regras' => (object) array(), 'modulos' => array(), 'resumo' => true );
			}
			$data['cursos']   = $todos_cursos;
			$data['pessoas']  = array_map(
				function ( $p ) {
					return array( 'id' => $p['id'], 'nome' => isset( $p['nome'] ) ? $p['nome'] : '', 'papel' => isset( $p['papel'] ) ? $p['papel'] : '' );
				},
				$data['pessoas']
			);
			$data['feriados'] = array_values(
				array_filter(
					$data['feriados'],
					function ( $f ) use ( $uids ) {
						return ! isset( $f[2] ) || '' === $f[2] || in_array( $f[2], $uids, true );
					}
				)
			);
			$data['unidades'] = array_values(
				array_filter(
					$data['unidades'],
					function ( $u ) use ( $uids ) {
						return in_array( $u['id'], $uids, true );
					}
				)
			);
		}
		$u = wp_get_current_user();
		return array(
			'me'       => array(
				'id'         => (int) $u->ID,
				'nome'       => $u->display_name,
				'perfil'     => $perfil,
				'unidades'   => $uids,
				'validador'  => self::validador(),
				'prazoDias'  => (int) get_option( 'cronograma_ead_prazo_dias', 5 ),
				'podeEquipe' => current_user_can( 'edit_users' ),
			),
			'catalogo' => $data,
			'crev'     => $cat['rev'],
			'turmas'   => $turmas,
		);
	}

	/* ---------- criar / salvar / excluir ---------- */

	public static function criar( $body ) {
		$perfil = self::perfil();
		if ( ! in_array( $perfil, array( 'equipe', 'unidade' ), true ) ) {
			return self::erro( 'sem_permissao', 'Seu perfil não pode criar turmas.', 403 );
		}
		$t = Cronograma_EAD_Store::sanitize_turma( isset( $body['turma'] ) ? $body['turma'] : null );
		if ( is_wp_error( $t ) ) {
			return $t;
		}
		if ( Cronograma_EAD_DB::get( $t['id'] ) ) {
			return self::erro( 'existe', 'Já existe uma turma com esta identificação.', 409 );
		}
		$cat = Cronograma_EAD_Store::get();
		// A unidade pode pedir um curso que ainda não existe: informa o nome e a Unidigit@l cadastra.
		$pedido_curso = ( 'unidade' === $perfil && empty( $t['cursoId'] ) && ! empty( $t['cursoSolicitado'] ) ) ? mb_substr( trim( (string) $t['cursoSolicitado'] ), 0, 160 ) : '';
		if ( '' === $pedido_curso && ( empty( $t['cursoId'] ) || null === self::ids_do_curso( $cat['data'], $t['cursoId'] ) ) ) {
			return self::erro( 'curso', 'Escolha um curso cadastrado ou informe o nome do curso que você precisa.', 422 );
		}
		if ( 'unidade' === $perfil ) {
			$mine = self::unidades_do_usuario();
			$uid  = isset( $t['unidadeId'] ) ? $t['unidadeId'] : '';
			if ( ! $uid && 1 === count( $mine ) ) {
				$uid = $mine[0];
			}
			if ( ! in_array( $uid, $mine, true ) ) {
				return self::erro( 'unidade', 'Escolha uma das suas unidades.', 403 );
			}
			// A unidade só informa o pedido; o restante nasce vazio.
			$t = array(
				'id'        => $t['id'],
				'cursoId'   => '' !== $pedido_curso ? '' : $t['cursoId'],
				'cursoSolicitado' => $pedido_curso,
				'nome'      => isset( $t['nome'] ) ? $t['nome'] : '',
				'unidadeId' => $uid,
				'inicio'    => isset( $t['inicio'] ) ? $t['inicio'] : '',
				'obs'       => isset( $t['obs'] ) ? $t['obs'] : '',
				'evento'    => '', 'monitorId' => '', 'tutorId' => '', 'coordId' => '', 'profId' => '', 'ambiente' => '',
				'itens'     => array(),
			);
			$status = Cronograma_EAD_Rules::S_SOLICITADO;
		} else {
			$status = Cronograma_EAD_Rules::S_ELABORACAO;
		}
		if ( empty( $t['unidadeId'] ) ) {
			return self::erro( 'unidade', 'Escolha a unidade da turma.', 422 );
		}
		$refs = self::validar_referencias_turma( $t, $cat['data'], ! ( 'unidade' === $perfil && '' !== $pedido_curso ) );
		if ( is_wp_error( $refs ) ) {
			return $refs;
		}
		if ( ! Cronograma_EAD_DB::inserir( $t, $status, get_current_user_id() ) ) {
			return self::erro( 'db', 'Não foi possível salvar a turma.', 500 );
		}
		Cronograma_EAD_DB::log( $t['id'], 1, 'solicitado' === $status ? 'solicitar' : 'criar', isset( $t['obs'] ) ? $t['obs'] : '' );
		$row = Cronograma_EAD_DB::get( $t['id'] );
		if ( 'solicitado' === $status ) {
			Cronograma_EAD_Notify::solicitacao( $row );
			Cronograma_EAD_Avisos::criar( $row, 'equipe', 'solicitacao', 'Nova solicitação de turma', ( isset( $t['nome'] ) ? $t['nome'] : $row->id ) . ( '' !== $pedido_curso ? ' — curso a cadastrar: ' . $pedido_curso : '' ) . ( ! empty( $t['obs'] ) ? ' — ' . $t['obs'] : '' ) );
		}
		return self::presentar( $row );
	}

	public static function salvar( $id, $body ) {
		$perfil = self::perfil();
		$row    = Cronograma_EAD_DB::get( $id );
		if ( ! $row || ! self::pode_ver( $row, $perfil ) ) {
			return self::erro( 'nao_achou', 'Turma não encontrada.', 404 );
		}
		if ( ! Cronograma_EAD_Rules::pode_editar( $row->status, $perfil ) ) {
			return self::erro( 'bloqueada', self::msg_bloqueio( $row->status, $perfil ), 403 );
		}
		$rev = isset( $body['rev'] ) ? (int) $body['rev'] : -1;
		if ( $rev !== (int) $row->rev ) {
			return self::erro( 'conflito', 'Esta turma foi alterada por outra pessoa.', 409, array( 'turma' => self::presentar( $row ) ) );
		}
		$in = Cronograma_EAD_Store::sanitize_turma( isset( $body['turma'] ) ? $body['turma'] : null );
		if ( is_wp_error( $in ) ) {
			return $in;
		}
		$stored = self::decodificar( $row );
		$cat    = Cronograma_EAD_Store::get();
		$motivo = isset( $body['motivo'] ) ? Cronograma_EAD_Rules::s( $body['motivo'] ) : '';

		if ( 'unidade' === $perfil ) {
			$novo    = Cronograma_EAD_Rules::merge_unidade( $stored, $in, self::ids_do_curso( $cat['data'], isset( $stored['cursoId'] ) ? $stored['cursoId'] : '' ) );
			$changes = Cronograma_EAD_Rules::diff( $stored, $novo );
			if ( ! $changes ) {
				return self::presentar( $row );
			}
			if ( Cronograma_EAD_Rules::mudou_data( $changes ) && '' === $motivo ) {
				return self::erro( 'motivo_obrigatorio', 'Explique em poucas palavras por que a data do encontro mudou.', 422 );
			}
			$unid = $row->unidade_id;
		} else {
			$novo    = Cronograma_EAD_Rules::merge_equipe( $stored, $in, self::ids_do_curso( $cat['data'], isset( $in['cursoId'] ) ? $in['cursoId'] : ( isset( $stored['cursoId'] ) ? $stored['cursoId'] : '' ) ) );
			$changes = Cronograma_EAD_Rules::diff( $stored, $novo );
			$unid    = isset( $novo['unidadeId'] ) ? $novo['unidadeId'] : $row->unidade_id;
			// Depois do envio, a unidade só muda de mãos por recolher; não deixa trocar de unidade ou de curso.
			if ( Cronograma_EAD_Rules::S_VALIDACAO === $row->status ) {
				$unid = $row->unidade_id;
				$novo['cursoId'] = isset( $stored['cursoId'] ) ? $stored['cursoId'] : '';
			}
			if ( ! $changes && $unid === $row->unidade_id ) {
				return self::presentar( $row );
			}
			if ( empty( $unid ) ) {
				return self::erro( 'unidade', 'A turma precisa de uma unidade.', 422 );
			}
		}
		$novo['unidadeId'] = $unid;
		$refs = self::validar_referencias_turma( $novo, $cat['data'], true );
		if ( is_wp_error( $refs ) ) {
			return $refs;
		}
		if ( ! Cronograma_EAD_DB::atualizar( $id, $rev, array( 'data' => $novo, 'unidade_id' => $unid ), get_current_user_id() ) ) {
			$cur = Cronograma_EAD_DB::get( $id );
			return self::erro( 'conflito', 'Esta turma foi alterada por outra pessoa.', 409, array( 'turma' => $cur ? self::presentar( $cur ) : null ) );
		}
		if ( 'unidade' === $perfil ) {
			Cronograma_EAD_DB::log( $id, $row->versao, 'ajuste', $motivo, $changes );
		} elseif ( Cronograma_EAD_Rules::S_VALIDACAO === $row->status && $changes ) {
			Cronograma_EAD_DB::log( $id, $row->versao, 'edicao_equipe', $motivo, $changes );
		}
		return self::presentar( Cronograma_EAD_DB::get( $id ) );
	}

	private static function nome_turma( $row ) {
		$t = json_decode( $row->data, true );
		return ( is_array( $t ) && ! empty( $t['nome'] ) ) ? $t['nome'] : $row->id;
	}

	/** Teste de entrega: envia um e-mail para quem pediu e devolve o resultado. */
	public static function email_teste() {
		if ( ! current_user_can( Cronograma_EAD_Roles::CAP_ACCOUNTS ) ) {
			return self::erro( 'sem_permissao', 'Sem permissão.', 403 );
		}
		$rate = Cronograma_EAD_Security::rate_limit( 'email_teste', '', 5, HOUR_IN_SECONDS );
		if ( is_wp_error( $rate ) ) {
			return $rate;
		}
		$u  = wp_get_current_user();
		$ok = (bool) wp_mail( $u->user_email, '[Cronogramas EaD] Teste de e-mail', "Se você recebeu esta mensagem, os avisos por e-mail estão funcionando.\n\n— Unidigit@l · Cronogramas EaD" );
		return array( 'ok' => $ok, 'para' => $u->user_email );
	}

	private static function msg_bloqueio( $status, $perfil ) {
		if ( Cronograma_EAD_Rules::S_VALIDADO === $status ) {
			return 'Este cronograma está validado e travado. Peça à Unidigit@l para reabrir.';
		}
		if ( 'unidade' === $perfil ) {
			return 'Este cronograma não está aberto para ajustes da unidade.';
		}
		return 'Este cronograma não pode ser alterado no status atual.';
	}

	public static function excluir( $id ) {
		$row = Cronograma_EAD_DB::get( $id );
		if ( ! $row || 'equipe' !== self::perfil() ) {
			return self::erro( 'nao_achou', 'Turma não encontrada.', 404 );
		}
		if ( ! in_array( $row->status, array( 'solicitado', 'elaboracao', 'arquivado' ), true ) || Cronograma_EAD_DB::versoes( $id ) ) {
			return self::erro( 'nao_exclui', 'Turmas enviadas à unidade ou já validadas não podem ser excluídas. Arquive a turma.', 409 );
		}
		Cronograma_EAD_DB::log( $id, $row->versao, 'excluir', '' );
		Cronograma_EAD_DB::audit_admin( 'turma_excluida', 'turma', $id, 'ok', array( 'status' => $row->status ) );
		Cronograma_EAD_DB::excluir( $id );
		return array( 'ok' => true );
	}

	/* ---------- transições ---------- */

	public static function acao( $id, $body ) {
		$perfil = self::perfil();
		$row    = Cronograma_EAD_DB::get( $id );
		if ( ! $row || ! self::pode_ver( $row, $perfil ) ) {
			return self::erro( 'nao_achou', 'Turma não encontrada.', 404 );
		}
		$acao   = isset( $body['acao'] ) ? sanitize_key( $body['acao'] ) : '';
		if ( 'validar' === $acao && 'equipe' === $perfil && ! current_user_can( Cronograma_EAD_Roles::CAP_VALIDATE_AS_UNIT ) ) {
			return self::erro( 'sem_permissao', self::msg_regra( 'sem_permissao' ), 403 );
		}
		$motivo = isset( $body['motivo'] ) ? Cronograma_EAD_Rules::s( $body['motivo'] ) : '';
		$ress   = isset( $body['ressalva'] ) ? Cronograma_EAD_Rules::s( $body['ressalva'] ) : '';
		$chk    = Cronograma_EAD_Rules::checar_acao( $acao, $row->status, $perfil, self::validador(), $motivo );
		if ( true !== $chk ) {
			return self::erro( $chk, self::msg_regra( $chk ), 'motivo_obrigatorio' === $chk ? 422 : 403 );
		}
		$rev = isset( $body['rev'] ) ? (int) $body['rev'] : -1;
		if ( $rev !== (int) $row->rev ) {
			return self::erro( 'conflito', 'Esta turma foi alterada por outra pessoa. Confira e tente de novo.', 409, array( 'turma' => self::presentar( $row ) ) );
		}
		if ( 'iniciar' === $acao ) {
			$dados = self::decodificar( $row );
			if ( empty( $dados['cursoId'] ) ) {
				return self::erro( 'curso_pendente', 'Esta turma pediu um curso que ainda não está cadastrado. Cadastre o curso (ou escolha um existente) antes de iniciar.', 422 );
			}
		}
		$def = Cronograma_EAD_Rules::acoes();
		$def = $def[ $acao ];
		$cat = Cronograma_EAD_Store::get();

		if ( 'comentar' === $acao ) {
			$sub = isset( $body['tipo'] ) ? sanitize_key( $body['tipo'] ) : 'alteracao';
			if ( ! in_array( $sub, Cronograma_EAD_Avisos::SUBTIPOS, true ) || ( 'reabertura' === $sub && Cronograma_EAD_Rules::S_VALIDADO !== $row->status ) ) {
				$sub = 'alteracao';
			}
			$rot = array( 'alteracao' => 'Pedido de alteração', 'reabertura' => 'Pedido de reabertura', 'duvida' => 'Dúvida' );
			if ( 'unidade' === $perfil ) {
				Cronograma_EAD_DB::log( $id, $row->versao, 'comentario', ( $rot[ $sub ] . ': ' ) . $motivo );
				Cronograma_EAD_Notify::comentario( $row, $motivo, $perfil );
				Cronograma_EAD_Avisos::criar( $row, 'equipe', 'pedido', $rot[ $sub ] . ' · ' . self::nome_turma( $row ), $motivo, $sub, 1 );
			} else {
				Cronograma_EAD_DB::log( $id, $row->versao, 'comentario', $motivo );
				Cronograma_EAD_Notify::comentario( $row, $motivo, $perfil );
				Cronograma_EAD_Avisos::criar( $row, 'unidade', 'mensagem', 'Mensagem da Unidigit@l · ' . self::nome_turma( $row ), $motivo );
				if ( ! empty( $body['atende'] ) ) {
					Cronograma_EAD_Avisos::atender_turma( $id, wp_get_current_user()->display_name );
				}
			}
			return self::presentar( $row );
		}

		$campos = array( 'status' => $def['para'] );
		if ( 'enviar' === $acao ) {
			$prazo = isset( $body['prazo'] ) ? Cronograma_EAD_Rules::s( $body['prazo'] ) : '';
			if ( ! Cronograma_EAD_Rules::data_ok( $prazo ) ) {
				$prazo = Cronograma_EAD_Rules::somar_uteis( current_time( 'Y-m-d' ), max( 1, (int) get_option( 'cronograma_ead_prazo_dias', 5 ) ), self::feriados_da_unidade( $cat['data'], $row->unidade_id ) );
			}
			$campos['prazo'] = $prazo;
		}
		$snapshot = null;
		$validador_nome = '';
		$validador_id = 0;
		if ( 'validar' === $acao ) {
			$campos['prazo'] = null;
			$u               = wp_get_current_user();
			$validador_id    = (int) $u->ID;
			$validador_nome  = $u->display_name . ( 'equipe' === $perfil ? ' (em nome da unidade)' : '' );
			$t               = self::decodificar( $row );
			$curso           = null;
			foreach ( $cat['data']['cursos'] as $c ) {
				if ( isset( $c['id'] ) && isset( $t['cursoId'] ) && $c['id'] === $t['cursoId'] ) {
					$curso = $c;
				}
			}
			$feriados = self::feriados_da_unidade( $cat['data'], $row->unidade_id );
			$unid = null;
			foreach ( $cat['data']['unidades'] as $x ) {
				if ( $x['id'] === $row->unidade_id ) {
					$unid = $x;
				}
			}
			$snapshot = array( 'turma' => Cronograma_EAD_Rules::para_saida( $t ), 'curso' => $curso, 'feriados' => $feriados, 'unidade' => $unid, 'versao' => (int) $row->versao );
		}
		if ( 'reabrir' === $acao ) {
			$campos['versao'] = (int) $row->versao + 1;
			$campos['prazo']  = Cronograma_EAD_Rules::somar_uteis( current_time( 'Y-m-d' ), max( 1, (int) get_option( 'cronograma_ead_prazo_dias', 5 ) ), self::feriados_da_unidade( $cat['data'], $row->unidade_id ) );
		}
		if ( in_array( $acao, array( 'recolher', 'arquivar' ), true ) ) {
			$campos['prazo'] = null;
		}
		Cronograma_EAD_DB::begin();
		if ( ! Cronograma_EAD_DB::atualizar( $id, $rev, $campos, get_current_user_id() ) ) {
			Cronograma_EAD_DB::rollback();
			return self::erro( 'conflito', 'Esta turma foi alterada por outra pessoa. Confira e tente de novo.', 409 );
		}
		if ( 'validar' === $acao && ! Cronograma_EAD_DB::salvar_versao( $id, $row->versao, $snapshot, $validador_id, $validador_nome, $ress ) ) {
			Cronograma_EAD_DB::rollback();
			return self::erro( 'db', 'Não foi possível guardar a versão validada.', 500 );
		}
		$log_motivo = $motivo;
		if ( 'validar' === $acao && '' !== $ress ) {
			$log_motivo = trim( $motivo . ' Ressalva: ' . $ress );
		}
		if ( ! Cronograma_EAD_DB::log( $id, $row->versao, $acao, $log_motivo ) ) {
			Cronograma_EAD_DB::rollback();
			return self::erro( 'db', 'Não foi possível registrar o histórico da operação.', 500 );
		}
		if ( ! Cronograma_EAD_DB::commit() ) {
			Cronograma_EAD_DB::rollback();
			return self::erro( 'db', 'Não foi possível concluir a operação.', 500 );
		}
		if ( 'validar' === $acao && 'equipe' === $perfil ) {
			Cronograma_EAD_DB::audit_admin( 'validacao_em_nome', 'turma', $id, 'ok', array( 'versao' => (int) $row->versao ), $motivo );
		}
		$nova = Cronograma_EAD_DB::get( $id );
		Cronograma_EAD_Notify::transicao( $acao, $nova, $motivo, $ress );
		$nome = self::nome_turma( $nova );
		$av   = array(
			'enviar'   => array( 'unidade', 'Cronograma para validar · ' . $nome, 'Está pronto para a sua validação.' . ( $nova->prazo ? ' Prazo: ' . gmdate( 'd/m/Y', strtotime( $nova->prazo ) ) . '.' : '' ) ),
			'recolher' => array( 'unidade', 'Cronograma recolhido · ' . $nome, 'A Unidigit@l recolheu para ajustes. Motivo: ' . $motivo ),
			'validar'  => array( 'equipe', 'Cronograma validado · ' . $nome, 'Validado (versão ' . (int) $nova->versao . ').' . ( '' !== $ress ? ' Ressalva: ' . $ress : '' ) ),
			'reabrir'  => array( 'unidade', 'Cronograma reaberto · ' . $nome, 'Voltou para a sua validação (versão ' . (int) $nova->versao . '). Motivo: ' . $motivo ),
			'iniciar'  => array( 'unidade', 'Solicitação aceita · ' . $nome, 'A Unidigit@l começou a montar o cronograma.' ),
		);
		if ( isset( $av[ $acao ] ) ) {
			Cronograma_EAD_Avisos::criar( $nova, $av[ $acao ][0], $acao, $av[ $acao ][1], $av[ $acao ][2] );
		}
		if ( 'reabrir' === $acao ) {
			Cronograma_EAD_Avisos::atender_turma( $id, wp_get_current_user()->display_name );
		}
		return self::presentar( $nova );
	}

	/* ---------- histórico e versões ---------- */

	public static function historico( $id ) {
		$row = Cronograma_EAD_DB::get( $id );
		if ( ! $row || ! self::pode_ver( $row, self::perfil() ) ) {
			return self::erro( 'nao_achou', 'Turma não encontrada.', 404 );
		}
		$log = array();
		$eq = ( 'equipe' === self::perfil() );
		foreach ( Cronograma_EAD_DB::historico( $id ) as $l ) {
			if ( ! $eq && 'email_falhou' === $l->acao ) {
				continue; // problema de e-mail é assunto da Unidigit@l, não da unidade.
			}
			$log[] = array(
				'id'      => (int) $l->id,
				'versao'  => (int) $l->versao,
				'quem'    => $l->user_nome,
				'perfil'  => $l->perfil,
				'acao'    => $l->acao,
				'motivo'  => (string) $l->motivo,
				'detalhe' => $l->detalhe ? json_decode( $l->detalhe, true ) : null,
				'em'      => $l->criado_em,
			);
		}
		$ver = array();
		foreach ( Cronograma_EAD_DB::versoes( $id ) as $v ) {
			$ver[] = array( 'versao' => (int) $v->versao, 'por' => $v->validado_nome, 'em' => $v->validado_em, 'ressalva' => (string) $v->ressalva );
		}
		return array( 'log' => $log, 'versoes' => $ver );
	}

	/** Atividade recente (painel Início): só de turmas que o usuário pode ver. */
	public static function atividade() {
		$perfil = self::perfil();
		if ( '' === $perfil ) {
			return self::erro( 'sem_permissao', 'Sem permissão.', 403 );
		}
		$out   = array();
		$cache = array();
		foreach ( Cronograma_EAD_DB::atividade( 80 ) as $l ) {
			if ( ! isset( $cache[ $l->turma_id ] ) ) {
				$row                     = Cronograma_EAD_DB::get( $l->turma_id );
				$cache[ $l->turma_id ] = $row && self::pode_ver( $row, $perfil );
			}
			if ( ! $cache[ $l->turma_id ] || ( 'equipe' !== $perfil && 'email_falhou' === $l->acao ) ) {
				continue;
			}
			$out[] = array(
				'id'      => (int) $l->id,
				'turmaId' => $l->turma_id,
				'versao'  => (int) $l->versao,
				'quem'    => $l->user_nome,
				'acao'    => $l->acao,
				'motivo'  => (string) $l->motivo,
				'em'      => $l->criado_em,
			);
			if ( count( $out ) >= 10 ) {
				break;
			}
		}
		return array( 'atividade' => $out );
	}

	public static function versao( $id, $n ) {
		$row = Cronograma_EAD_DB::get( $id );
		if ( ! $row || ! self::pode_ver( $row, self::perfil() ) ) {
			return self::erro( 'nao_achou', 'Turma não encontrada.', 404 );
		}
		$v = Cronograma_EAD_DB::versao( $id, $n );
		if ( ! $v ) {
			return self::erro( 'nao_achou', 'Versão não encontrada.', 404 );
		}
		$snap = json_decode( $v->snapshot, true );
		return array( 'versao' => (int) $v->versao, 'por' => $v->validado_nome, 'em' => $v->validado_em, 'ressalva' => (string) $v->ressalva, 'snapshot' => $snap );
	}

	/* ---------- catálogo ---------- */

	public static function salvar_catalogo( $body ) {
		if ( ! is_array( $body ) || ! array_key_exists( 'data', $body ) || ! isset( $body['rev'] ) ) {
			return self::erro( 'invalido', 'Envie "data" e "rev".', 400 );
		}
		$clean = Cronograma_EAD_Store::sanitize_payload( $body['data'] );
		if ( is_wp_error( $clean ) ) {
			return $clean;
		}
		// Não deixa remover curso ou unidade que ainda têm turmas.
		$em_uso_c = array();
		$em_uso_u = array();
		foreach ( Cronograma_EAD_DB::listar( null ) as $r ) {
			$t = json_decode( $r->data, true );
			if ( is_array( $t ) && ! empty( $t['cursoId'] ) ) {
				$em_uso_c[ $t['cursoId'] ] = true;
			}
			$em_uso_u[ $r->unidade_id ] = true;
		}
		$ids_c = array_column( $clean['cursos'], 'id' );
		$ids_u = array_column( $clean['unidades'], 'id' );
		foreach ( array_keys( $em_uso_c ) as $c ) {
			if ( ! in_array( $c, $ids_c, true ) ) {
				return self::erro( 'em_uso', 'Há turmas usando um curso que foi removido. Exclua ou arquive as turmas antes.', 422 );
			}
		}
		foreach ( array_keys( $em_uso_u ) as $u ) {
			if ( '' !== $u && ! in_array( $u, $ids_u, true ) ) {
				return self::erro( 'em_uso', 'Há turmas ligadas a uma unidade que foi removida.', 422 );
			}
		}
		$saved = Cronograma_EAD_Store::save( $clean, (int) $body['rev'] );
		if ( ! is_wp_error( $saved ) ) {
			Cronograma_EAD_DB::audit_admin( 'catalogo_atualizado', 'catalogo', '', 'ok', array( 'rev' => $saved['rev'] ) );
		}
		return $saved;
	}

	/** Consulta e armazena em cache os feriados nacionais brasileiros. */
	public static function feriados_nacionais( $ano ) {
		$ano = (int) $ano;
		if ( $ano < 1900 || $ano > 2199 ) {
			return self::erro( 'ano', 'Ano inválido para consulta de feriados.', 400 );
		}
		$key = 'cronograma_ead_feriados_br_' . $ano;
		$cached = get_transient( $key );
		if ( is_array( $cached ) ) {
			return array( 'ano' => $ano, 'feriados' => $cached, 'cache' => true );
		}
		$url = 'https://brasilapi.com.br/api/feriados/v1/' . $ano;
		$res = wp_safe_remote_get( $url, array( 'timeout' => 8, 'redirection' => 2, 'headers' => array( 'Accept' => 'application/json' ) ) );
		if ( is_wp_error( $res ) ) {
			return self::erro( 'feriados_indisponiveis', 'Não foi possível consultar os feriados nacionais agora. Tente novamente mais tarde.', 503 );
		}
		$status = (int) wp_remote_retrieve_response_code( $res );
		$body = json_decode( wp_remote_retrieve_body( $res ), true );
		if ( 200 !== $status || ! is_array( $body ) ) {
			return self::erro( 'feriados_indisponiveis', 'O serviço de feriados nacionais retornou uma resposta inválida.', 503 );
		}
		$out = array();
		foreach ( $body as $item ) {
			if ( ! is_array( $item ) ) {
				continue;
			}
			$data = isset( $item['date'] ) ? sanitize_text_field( (string) $item['date'] ) : '';
			$nome = isset( $item['name'] ) ? sanitize_text_field( (string) $item['name'] ) : 'Feriado nacional';
			if ( Cronograma_EAD_Rules::data_ok( $data ) ) {
				$out[] = array( $data, $nome );
			}
		}
		if ( ! $out ) {
			return self::erro( 'feriados_indisponiveis', 'Nenhum feriado nacional foi retornado para o ano informado.', 503 );
		}
		set_transient( $key, $out, 30 * DAY_IN_SECONDS );
		return array( 'ano' => $ano, 'feriados' => $out, 'cache' => false );
	}

	/** Cópia completa, versionada e verificável por checksum. */
	public static function exportar() {
		$cat    = Cronograma_EAD_Store::get();
		$turmas = array();
		foreach ( Cronograma_EAD_DB::listar( null ) as $r ) {
			$turmas[] = self::presentar( $r );
		}
		$data = array( 'catalogo' => $cat['data'], 'turmas' => $turmas );
		$out = array(
			'format' => 'cronogramas-ead',
			'schemaVersion' => 3,
			'applicationVersion' => CRONOGRAMA_EAD_VERSION,
			'generatedAt' => gmdate( 'c' ),
			'siteId' => hash( 'sha256', home_url( '/' ) ),
			'checksum' => hash( 'sha256', wp_json_encode( $data ) ),
			'catalogo' => $cat['data'],
			'turmas' => $turmas,
		);
		Cronograma_EAD_DB::audit_admin( 'exportar_backup', 'sistema', '', 'ok', array( 'turmas' => count( $turmas ) ) );
		return $out;
	}

	private static function preparar_importacao( $body ) {
		if ( ! is_array( $body ) || ! isset( $body['catalogo'] ) || ! isset( $body['turmas'] ) || ! is_array( $body['turmas'] ) ) {
			return self::erro( 'invalido', 'Arquivo de cópia inválido.', 400 );
		}
		$format = isset( $body['format'] ) ? (string) $body['format'] : ( isset( $body['formato'] ) ? (string) $body['formato'] : '' );
		$schema = isset( $body['schemaVersion'] ) ? (int) $body['schemaVersion'] : ( 'cronogramas-ead-2' === $format ? 2 : 0 );
		if ( $schema > 3 ) {
			return self::erro( 'versao_futura', 'Esta cópia foi criada por uma versão mais nova do sistema.', 422 );
		}
		if ( ! in_array( $schema, array( 0, 2, 3 ), true ) ) {
			return self::erro( 'versao', 'Versão de backup não suportada.', 422 );
		}
		$cat = Cronograma_EAD_Store::sanitize_payload( $body['catalogo'] );
		if ( is_wp_error( $cat ) ) {
			return $cat;
		}
		if ( 3 === $schema ) {
			if ( 'cronogramas-ead' !== $format || empty( $body['checksum'] ) ) {
				return self::erro( 'formato', 'Backup versão 3 sem identificação ou checksum válido.', 422 );
			}
			$calc = hash( 'sha256', wp_json_encode( array( 'catalogo' => $body['catalogo'], 'turmas' => $body['turmas'] ) ) );
			if ( ! hash_equals( (string) $body['checksum'], $calc ) ) {
				return self::erro( 'checksum', 'A cópia falhou na verificação de integridade.', 422 );
			}
		}
		$validas = array();
		$criadas = 0;
		$atualizadas = 0;
		$ignoradas = 0;
		foreach ( $body['turmas'] as $raw ) {
			$t = Cronograma_EAD_Store::sanitize_turma( $raw );
			if ( is_wp_error( $t ) ) {
				return $t;
			}
			$refs = self::validar_referencias_turma( $t, $cat, true );
			if ( is_wp_error( $refs ) ) {
				return $refs;
			}
			$row = Cronograma_EAD_DB::get( $t['id'] );
			if ( ! $row ) {
				$criadas++;
			} elseif ( in_array( $row->status, array( 'elaboracao', 'solicitado' ), true ) ) {
				$atualizadas++;
			} else {
				$ignoradas++;
			}
			$validas[] = $t;
		}
		return array( 'catalogo' => $cat, 'turmas' => $validas, 'criadas' => $criadas, 'atualizadas' => $atualizadas, 'ignoradas' => $ignoradas, 'schemaVersion' => $schema, 'digest' => hash( 'sha256', wp_json_encode( array( 'catalogo' => $cat, 'turmas' => $validas ) ) ) );
	}

	/** Simula ou executa uma importação de forma atômica. */
	public static function importar( $body ) {
		$rate = Cronograma_EAD_Security::rate_limit( 'importar', '', 5, HOUR_IN_SECONDS );
		if ( is_wp_error( $rate ) ) {
			return $rate;
		}
		$prep = self::preparar_importacao( $body );
		if ( is_wp_error( $prep ) ) {
			Cronograma_EAD_DB::audit_admin( 'importar_backup', 'sistema', '', 'rejeitado', null, $prep->get_error_message() );
			return $prep;
		}
		$confirm = hash_hmac( 'sha256', $prep['digest'] . '|' . get_current_user_id(), wp_salt( 'auth' ) );
		if ( ! empty( $body['simular'] ) ) {
			return array( 'simulacao' => true, 'criadas' => $prep['criadas'], 'atualizadas' => $prep['atualizadas'], 'ignoradas' => $prep['ignoradas'], 'schemaVersion' => $prep['schemaVersion'], 'confirmacao' => $confirm );
		}
		if ( empty( $body['confirmacao'] ) || ! hash_equals( $confirm, (string) $body['confirmacao'] ) ) {
			return self::erro( 'confirmacao', 'Execute a simulação e confirme o relatório antes de importar.', 409 );
		}
		if ( ! isset( $body['rev'] ) ) {
			return self::erro( 'invalido', 'Revisão atual ausente.', 400 );
		}
		$pre_backup = self::exportar();
		update_option( 'cronograma_ead_pre_import_backup', wp_json_encode( $pre_backup ), false );
		update_option( 'cronograma_ead_pre_import_backup_at', gmdate( 'c' ), false );
		Cronograma_EAD_DB::begin();
		$saved = Cronograma_EAD_Store::save( $prep['catalogo'], (int) $body['rev'] );
		if ( is_wp_error( $saved ) ) {
			Cronograma_EAD_DB::rollback();
			return $saved;
		}
		foreach ( $prep['turmas'] as $t ) {
			$row = Cronograma_EAD_DB::get( $t['id'] );
			if ( ! $row ) {
				if ( ! Cronograma_EAD_DB::inserir( $t, Cronograma_EAD_Rules::S_ELABORACAO, get_current_user_id() ) ) {
					Cronograma_EAD_DB::rollback();
					return self::erro( 'importacao', 'Falha ao criar turma durante a importação. Nada foi alterado.', 500 );
				}
			} elseif ( in_array( $row->status, array( 'elaboracao', 'solicitado' ), true ) ) {
				$novo = Cronograma_EAD_Rules::merge_equipe( self::decodificar( $row ), $t, self::ids_do_curso( $prep['catalogo'], $t['cursoId'] ) );
				if ( ! Cronograma_EAD_DB::atualizar( $row->id, $row->rev, array( 'data' => $novo, 'unidade_id' => $t['unidadeId'] ), get_current_user_id() ) ) {
					Cronograma_EAD_DB::rollback();
					return self::erro( 'conflito', 'Uma turma mudou durante a importação. Nada foi alterado.', 409 );
				}
			}
		}
		if ( ! Cronograma_EAD_DB::commit() ) {
			Cronograma_EAD_DB::rollback();
			return self::erro( 'importacao', 'Não foi possível concluir a importação.', 500 );
		}
		Cronograma_EAD_DB::audit_admin( 'importar_backup', 'sistema', '', 'ok', array( 'criadas' => $prep['criadas'], 'atualizadas' => $prep['atualizadas'], 'ignoradas' => $prep['ignoradas'] ) );
		return array( 'rev' => $saved['rev'], 'turmas' => $prep['criadas'] + $prep['atualizadas'], 'puladas' => $prep['ignoradas'], 'criadas' => $prep['criadas'], 'atualizadas' => $prep['atualizadas'], 'ignoradas' => $prep['ignoradas'] );
	}



	/** Trilha administrativa disponível somente para a capability de auditoria. */
	public static function auditoria( $limit = 100 ) {
		$limit = $limit > 0 ? min( 500, $limit ) : 100;
		$out = array();
		foreach ( Cronograma_EAD_DB::audit_recent( $limit ) as $row ) {
			$detail = null;
			if ( is_string( $row->detalhe ) && '' !== $row->detalhe ) {
				$decoded = json_decode( $row->detalhe, true );
				$detail = is_array( $decoded ) ? $decoded : null;
			}
			$out[] = array(
				'id' => (int) $row->id,
				'requestId' => (string) $row->request_id,
				'userId' => (int) $row->user_id,
				'userName' => (string) $row->user_nome,
				'action' => (string) $row->acao,
				'entityType' => (string) $row->entidade,
				'entityId' => (string) $row->entidade_id,
				'result' => (string) $row->resultado,
				'reason' => (string) $row->motivo,
				'detail' => $detail,
				'createdAt' => (string) $row->criado_em,
			);
		}
		return array( 'items' => $out, 'count' => count( $out ) );
	}

	/** Diagnóstico operacional sem expor segredos. */
	public static function saude() {
		global $wpdb;
		$tables = array( 'turmas', 'versoes', 'log', 'avisos', 'audit' );
		$estado = array();
		foreach ( $tables as $name ) {
			$table = Cronograma_EAD_DB::t( $name );
			$estado[ $name ] = $table === $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table ) ); // phpcs:ignore WordPress.DB.PreparedSQL
		}
		$next = wp_next_scheduled( 'cronograma_ead_diario' );
		return array(
			'pluginVersion' => CRONOGRAMA_EAD_VERSION,
			'dbVersion' => (string) get_option( Cronograma_EAD_DB::OPT, '' ),
			'phpVersion' => PHP_VERSION,
			'wordpressVersion' => get_bloginfo( 'version' ),
			'tables' => $estado,
			'cron' => array(
				'lastRun' => (string) get_option( 'cronograma_ead_ultimo_cron', '' ),
				'nextRun' => $next ? gmdate( 'c', $next ) : '',
			),
			'rest' => rest_url( Cronograma_EAD_REST::NS . '/' ),
			'catalogRevision' => (int) get_option( Cronograma_EAD_Store::OPT_REV, 0 ),
			'turmas' => Cronograma_EAD_DB::contar(),
			'lastPreImportBackup' => (string) get_option( 'cronograma_ead_pre_import_backup_at', '' ),
			'requestId' => Cronograma_EAD_Security::request_id(),
		);
	}

	/* ---------- migração da versão 1 ---------- */

	/** A versão 1 guardava as turmas dentro do catálogo. Move para a tabela. */
	public static function migrar_v1() {
		$raw  = get_option( Cronograma_EAD_Store::OPT_DATA, '' );
		$data = is_string( $raw ) && '' !== $raw ? json_decode( $raw, true ) : null;
		if ( ! is_array( $data ) || ! isset( $data['turmas'] ) ) {
			return;
		}
		$unidades = isset( $data['unidades'] ) && is_array( $data['unidades'] ) ? $data['unidades'] : array();
		foreach ( $data['turmas'] as $t ) {
			if ( ! is_array( $t ) || empty( $t['id'] ) ) {
				continue;
			}
			$nome = isset( $t['unidade'] ) ? trim( (string) $t['unidade'] ) : '';
			$uid  = '';
			foreach ( $unidades as $u ) {
				if ( isset( $u['nome'] ) && $u['nome'] === $nome ) {
					$uid = $u['id'];
				}
			}
			if ( '' === $uid ) {
				$uid        = 'u_' . substr( md5( $nome ?: 'padrao' ), 0, 8 );
				$unidades[] = array( 'id' => $uid, 'nome' => $nome ?: 'Unidade padrão', 'cidade' => '' );
			}
			unset( $t['unidade'] );
			$t['unidadeId'] = $uid;
			if ( ! Cronograma_EAD_DB::get( $t['id'] ) ) {
				Cronograma_EAD_DB::inserir( $t, Cronograma_EAD_Rules::S_ELABORACAO, 0 );
			}
		}
		unset( $data['turmas'] );
		$data['unidades'] = $unidades;
		update_option( Cronograma_EAD_Store::OPT_DATA, wp_json_encode( $data ), false );
		update_option( Cronograma_EAD_Store::OPT_REV, (int) get_option( Cronograma_EAD_Store::OPT_REV, 0 ) + 1, false );
	}
}
