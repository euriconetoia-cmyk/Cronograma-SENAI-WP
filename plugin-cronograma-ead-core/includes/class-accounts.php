<?php
/**
 * Acessos: cadastro de usuários do sistema dentro do próprio sistema.
 *
 * Tipos de acesso:
 *   equipe       Unidigit@l — conduz o fluxo, edita cursos, turmas, feriados e acessos
 *   coordenador  unidade escolar — ajusta e VALIDA as turmas da(s) sua(s) unidade(s)
 *   auxiliar     unidade escolar — só ajusta, não valida
 *   consulta     só vê as turmas da(s) sua(s) unidade(s)
 *
 * Quem cria o quê:
 *   - Administrador do site (edit_users): todos os tipos.
 *   - Equipe Unidigit@l: coordenador, auxiliar e consulta (não cria outro membro da equipe).
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Cronograma_EAD_Accounts {

	const META_INATIVO = 'ce_inativo';
	const META_ULTIMO  = 'ce_ultimo_acesso';

	const ROLE_EQUIPE   = 'cronograma_ead_equipe';
	const ROLE_UNIDADE  = 'cronograma_ead_unidade';
	const ROLE_CONSULTA = 'cronograma_ead_consulta';

	public static function tipos() {
		return array(
			'equipe'      => 'Equipe Unidigit@l',
			'coordenador' => 'Coordenador da unidade',
			'auxiliar'    => 'Auxiliar da unidade',
			'consulta'    => 'Consulta',
		);
	}

	public static function hooks() {
		add_filter( 'wp_authenticate_user', array( __CLASS__, 'barrar_inativo' ), 10, 2 );
		add_action( 'wp_login', array( __CLASS__, 'registrar_acesso' ), 10, 2 );
		// Links de criação/redefinição de senha expiram em 2 horas.
		add_filter( 'password_reset_expiration', function () {
			return 2 * HOUR_IN_SECONDS;
		} );
	}

	/* ---------- bloqueio de quem foi desativado ---------- */

	public static function inativo( $uid ) {
		return (bool) get_user_meta( (int) $uid, self::META_INATIVO, true );
	}

	public static function barrar_inativo( $user, $password ) {
		if ( $user instanceof WP_User && self::inativo( $user->ID ) ) {
			return new WP_Error( 'cronograma_ead_inativo', '<strong>Acesso desativado.</strong> Fale com a Unidigit@l para reativar o seu usuário.' );
		}
		return $user;
	}

	public static function registrar_acesso( $login, $user ) {
		if ( $user instanceof WP_User ) {
			update_user_meta( $user->ID, self::META_ULTIMO, gmdate( 'c' ) );
		}
	}

	/* ---------- permissões ---------- */

	public static function pode_gerir_equipe() {
		return current_user_can( 'edit_users' );
	}

	private static function erro( $codigo, $msg, $status = 400 ) {
		return new WP_Error( 'cronograma_ead_' . $codigo, $msg, array( 'status' => $status ) );
	}

	/* ---------- leitura ---------- */

	private static function protegido( WP_User $u ) {
		return in_array( 'administrator', (array) $u->roles, true );
	}

	public static function tipo_de( WP_User $u ) {
		if ( self::protegido( $u ) || in_array( self::ROLE_EQUIPE, (array) $u->roles, true ) ) {
			return 'equipe';
		}
		if ( in_array( self::ROLE_UNIDADE, (array) $u->roles, true ) ) {
			return Cronograma_EAD_Service::validador( $u->ID ) ? 'coordenador' : 'auxiliar';
		}
		if ( in_array( self::ROLE_CONSULTA, (array) $u->roles, true ) ) {
			return 'consulta';
		}
		return '';
	}

	public static function presentar( WP_User $u ) {
		$ult = get_user_meta( $u->ID, self::META_ULTIMO, true );
		return array(
			'id'           => (int) $u->ID,
			'nome'         => $u->display_name,
			'email'        => $u->user_email,
			'login'        => $u->user_login,
			'tipo'         => self::tipo_de( $u ),
			'unidades'     => Cronograma_EAD_Service::unidades_do_usuario( $u->ID ),
			'ativo'        => ! self::inativo( $u->ID ),
			'ultimoAcesso' => is_string( $ult ) ? $ult : '',
			'protegido'    => self::protegido( $u ),
			'voce'         => (int) $u->ID === get_current_user_id(),
		);
	}

	public static function listar() {
		$users = get_users(
			array(
				'role__in' => array( self::ROLE_EQUIPE, self::ROLE_UNIDADE, self::ROLE_CONSULTA, 'administrator' ),
				'orderby'  => 'display_name',
				'order'    => 'ASC',
				'number'   => 500,
			)
		);
		return array(
			'usuarios'     => array_map( array( __CLASS__, 'presentar' ), $users ),
			'podeEquipe'   => self::pode_gerir_equipe(),
			'loginUrl'     => wp_login_url(),
		);
	}

	/* ---------- criação e alteração ---------- */

	private static function ids_unidades() {
		$cat = Cronograma_EAD_Store::get();
		$ids = array();
		foreach ( (array) $cat['data']['unidades'] as $u ) {
			$ids[] = (string) $u['id'];
		}
		return $ids;
	}

	/** Confere tipo e unidades; devolve array limpo ou WP_Error. */
	private static function validar_tipo_unidades( $tipo, $unidades ) {
		if ( ! array_key_exists( $tipo, self::tipos() ) ) {
			return self::erro( 'tipo_invalido', 'Escolha o tipo de acesso.' );
		}
		if ( 'equipe' === $tipo && ! self::pode_gerir_equipe() ) {
			return self::erro( 'sem_permissao', 'Só o administrador do site cria ou altera membros da equipe Unidigit@l.', 403 );
		}
		if ( 'equipe' === $tipo ) {
			return array();
		}
		$unidades = array_values( array_unique( array_map( 'strval', is_array( $unidades ) ? $unidades : array() ) ) );
		$unidades = array_values( array_intersect( $unidades, self::ids_unidades() ) );
		if ( ! $unidades ) {
			return self::erro( 'sem_unidade', 'Escolha pelo menos uma unidade escolar.' );
		}
		return $unidades;
	}

	private static function role_do_tipo( $tipo ) {
		if ( 'equipe' === $tipo ) {
			return self::ROLE_EQUIPE;
		}
		return 'consulta' === $tipo ? self::ROLE_CONSULTA : self::ROLE_UNIDADE;
	}

	private static function login_livre( $email ) {
		$base = sanitize_user( strtolower( strstr( $email, '@', true ) ), true );
		$base = $base ? $base : 'usuario';
		if ( strlen( $base ) < 3 ) {
			$base .= 'usr';
		}
		$login = $base;
		$n     = 1;
		while ( username_exists( $login ) ) {
			$n++;
			$login = $base . $n;
		}
		return $login;
	}

	public static function link_acesso( WP_User $u ) {
		$key = get_password_reset_key( $u );
		if ( is_wp_error( $key ) ) {
			return '';
		}
		return network_site_url( 'wp-login.php?action=rp&key=' . $key . '&login=' . rawurlencode( $u->user_login ), 'login' );
	}

	private static function enviar_email( WP_User $u, $link, $novo ) {
		$site  = 'Unidigit@l';
		$sist  = Cronograma_EAD_Pages::urls();
		$sist  = isset( $sist['cronograma'] ) ? $sist['cronograma'] : home_url( '/' );
		$msg   = "Olá, {$u->display_name}!\n\n";
		$msg  .= $novo ? "A Unidigit@l criou o seu acesso ao sistema de cronogramas.\n\n" : "Segue o seu link de acesso ao sistema de cronogramas.\n\n";
		$msg  .= "Seu usuário: {$u->user_login}\n\n";
		$msg  .= "1) Crie a sua senha neste link (vale por 2 horas):\n{$link}\n\n";
		$msg  .= "2) Depois, entre sempre por aqui:\n{$sist}\n\n";
		$msg  .= "Se o link expirar, use \"Perdeu a senha?\" na tela de entrada ou peça um novo à Unidigit@l.\n";
		return (bool) wp_mail( $u->user_email, '[' . $site . '] Seu acesso ao sistema de cronogramas', $msg );
	}

	public static function criar( $body ) {
		$rate = Cronograma_EAD_Security::rate_limit( 'criar_usuario', '', 20, HOUR_IN_SECONDS );
		if ( is_wp_error( $rate ) ) {
			return $rate;
		}
		$nome  = Cronograma_EAD_Rules::s( isset( $body['nome'] ) ? $body['nome'] : '' );
		$email = sanitize_email( isset( $body['email'] ) ? (string) $body['email'] : '' );
		$tipo  = isset( $body['tipo'] ) ? (string) $body['tipo'] : '';
		if ( '' === $nome ) {
			return self::erro( 'sem_nome', 'Informe o nome da pessoa.' );
		}
		if ( ! is_email( $email ) ) {
			return self::erro( 'email_invalido', 'Informe um e-mail válido.' );
		}
		if ( email_exists( $email ) ) {
			return self::erro( 'email_existe', 'Já existe um usuário com este e-mail.', 409 );
		}
		$unidades = self::validar_tipo_unidades( $tipo, isset( $body['unidades'] ) ? $body['unidades'] : array() );
		if ( is_wp_error( $unidades ) ) {
			return $unidades;
		}
		$id = wp_insert_user(
			array(
				'user_login'           => self::login_livre( $email ),
				'user_email'           => $email,
				'user_pass'            => wp_generate_password( 20, true, false ),
				'display_name'         => $nome,
				'first_name'           => $nome,
				'nickname'             => $nome,
				'role'                 => self::role_do_tipo( $tipo ),
				'show_admin_bar_front' => 'false',
			)
		);
		if ( is_wp_error( $id ) ) {
			return self::erro( 'falha_criar', $id->get_error_message() );
		}
		update_user_meta( $id, Cronograma_EAD_Users::META_UNIDADES, $unidades );
		update_user_meta( $id, Cronograma_EAD_Users::META_VALIDADOR, 'coordenador' === $tipo ? 1 : 0 );
		$u   = get_userdata( $id );
		$env = false;
		if ( ! empty( $body['enviarEmail'] ) ) {
			$link = self::link_acesso( $u );
			$env  = $link ? self::enviar_email( $u, $link, true ) : false;
		}
		if ( class_exists( 'Cronograma_EAD_DB' ) ) {
			Cronograma_EAD_DB::audit_admin( 'usuario_criado', 'usuario', (string) $id, $env ? 'ok' : 'ok_sem_email', array( 'tipo' => $tipo ) );
		}
		return array(
			'usuario'      => self::presentar( $u ),
			'emailEnviado' => $env,
		);
	}

	/** Usuário que esta tela pode mexer, ou WP_Error. */
	private static function alvo( $id ) {
		$u = get_userdata( (int) $id );
		if ( ! $u || '' === self::tipo_de( $u ) ) {
			return self::erro( 'nao_encontrado', 'Usuário não encontrado.', 404 );
		}
		if ( self::protegido( $u ) ) {
			return self::erro( 'protegido', 'Administradores do site são gerenciados em Usuários, no painel do WordPress.', 403 );
		}
		if ( 'equipe' === self::tipo_de( $u ) && ! self::pode_gerir_equipe() ) {
			return self::erro( 'sem_permissao', 'Só o administrador do site altera membros da equipe Unidigit@l.', 403 );
		}
		return $u;
	}

	public static function atualizar( $id, $body ) {
		$u = self::alvo( $id );
		if ( is_wp_error( $u ) ) {
			return $u;
		}
		$voce = (int) $u->ID === get_current_user_id();
		$args = array( 'ID' => $u->ID );

		if ( isset( $body['nome'] ) ) {
			$nome = Cronograma_EAD_Rules::s( $body['nome'] );
			if ( '' === $nome ) {
				return self::erro( 'sem_nome', 'Informe o nome da pessoa.' );
			}
			$args['display_name'] = $nome;
			$args['first_name']   = $nome;
			$args['nickname']     = $nome;
		}
		if ( isset( $body['email'] ) && strtolower( (string) $body['email'] ) !== strtolower( $u->user_email ) ) {
			$email = sanitize_email( (string) $body['email'] );
			if ( ! is_email( $email ) ) {
				return self::erro( 'email_invalido', 'Informe um e-mail válido.' );
			}
			$outro = email_exists( $email );
			if ( $outro && (int) $outro !== (int) $u->ID ) {
				return self::erro( 'email_existe', 'Já existe um usuário com este e-mail.', 409 );
			}
			$args['user_email'] = $email;
		}

		$tipo = isset( $body['tipo'] ) ? (string) $body['tipo'] : self::tipo_de( $u );
		if ( $voce && $tipo !== self::tipo_de( $u ) ) {
			return self::erro( 'voce', 'Você não pode mudar o seu próprio tipo de acesso.', 403 );
		}
		$unidades = self::validar_tipo_unidades( $tipo, array_key_exists( 'unidades', (array) $body ) ? $body['unidades'] : Cronograma_EAD_Service::unidades_do_usuario( $u->ID ) );
		if ( is_wp_error( $unidades ) ) {
			return $unidades;
		}
		if ( array_key_exists( 'ativo', (array) $body ) && ! $body['ativo'] && $voce ) {
			return self::erro( 'voce', 'Você não pode desativar o seu próprio acesso.', 403 );
		}

		if ( count( $args ) > 1 ) {
			$r = wp_update_user( $args );
			if ( is_wp_error( $r ) ) {
				return self::erro( 'falha_salvar', $r->get_error_message() );
			}
		}
		$u = get_userdata( $u->ID );
		if ( $tipo !== self::tipo_de( $u ) || ! in_array( self::role_do_tipo( $tipo ), (array) $u->roles, true ) ) {
			$u->set_role( self::role_do_tipo( $tipo ) );
		}
		update_user_meta( $u->ID, Cronograma_EAD_Users::META_UNIDADES, $unidades );
		update_user_meta( $u->ID, Cronograma_EAD_Users::META_VALIDADOR, 'coordenador' === $tipo ? 1 : 0 );

		if ( array_key_exists( 'ativo', (array) $body ) ) {
			if ( $body['ativo'] ) {
				delete_user_meta( $u->ID, self::META_INATIVO );
			} else {
				update_user_meta( $u->ID, self::META_INATIVO, 1 );
				$sessoes = WP_Session_Tokens::get_instance( $u->ID );
				$sessoes->destroy_all();
			}
		}
		Cronograma_EAD_DB::audit_admin( array_key_exists( 'ativo', (array) $body ) ? ( $body['ativo'] ? 'usuario_reativado' : 'usuario_desativado' ) : 'usuario_atualizado', 'usuario', (string) $u->ID, 'ok', array( 'tipo' => $tipo, 'unidades' => $unidades ) );
		return array( 'usuario' => self::presentar( get_userdata( $u->ID ) ) );
	}

	public static function novo_link( $id, $body ) {
		$u = self::alvo( $id );
		if ( is_wp_error( $u ) ) {
			return $u;
		}
		if ( self::inativo( $u->ID ) ) {
			return self::erro( 'inativo', 'Este acesso está desativado. Reative antes de enviar um novo acesso.', 409 );
		}
		$rate = Cronograma_EAD_Security::rate_limit( 'novo_link', (string) $u->ID, 3, HOUR_IN_SECONDS );
		if ( is_wp_error( $rate ) ) {
			return $rate;
		}
		$link = self::link_acesso( $u );
		if ( ! $link ) {
			return self::erro( 'falha_link', 'Não foi possível gerar o link agora. Tente de novo.', 500 );
		}
		$env = self::enviar_email( $u, $link, false );
		Cronograma_EAD_DB::audit_admin( 'link_acesso_solicitado', 'usuario', (string) $u->ID, $env ? 'enviado' : 'falha_email' );
		if ( ! $env ) {
			return self::erro( 'falha_email', 'O link foi gerado, mas o e-mail não pôde ser enviado. Nenhum token foi exposto. Verifique o SMTP e tente novamente.', 502 );
		}
		return array( 'emailEnviado' => true );
	}
}
