<?php
/** API REST: /wp-json/cronograma-ead/v1/ */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Cronograma_EAD_REST {
	const NS = 'cronograma-ead/v1';

	public static function register() {
		$id = array( 'id' => array( 'validate_callback' => array( 'Cronograma_EAD_Store', 'valid_id' ) ) );
		register_rest_route( self::NS, '/bootstrap', array( 'methods' => 'GET', 'callback' => array( __CLASS__, 'bootstrap' ), 'permission_callback' => array( __CLASS__, 'can_view' ) ) );
		register_rest_route( self::NS, '/catalogo', array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'catalogo' ), 'permission_callback' => array( __CLASS__, 'can_manage_catalog' ) ) );
		register_rest_route( self::NS, '/feriados/nacionais/(?P<ano>\d{4})', array( 'methods' => 'GET', 'callback' => array( __CLASS__, 'feriados_nacionais' ), 'permission_callback' => array( __CLASS__, 'can_manage_catalog' ) ) );
		register_rest_route( self::NS, '/localidades/municipios/(?P<uf>[A-Za-z]{2})', array( 'methods' => 'GET', 'callback' => array( __CLASS__, 'municipios' ), 'permission_callback' => array( __CLASS__, 'can_manage_catalog' ) ) );
		register_rest_route( self::NS, '/feriados/local/(?P<id>[A-Za-z0-9_\-]+)/(?P<ano>\d{4})', array( 'methods' => 'GET', 'callback' => array( __CLASS__, 'feriados_local' ), 'permission_callback' => array( __CLASS__, 'can_manage_catalog' ) ) );
		register_rest_route(
			self::NS,
			'/feriados/config',
			array(
				array( 'methods' => 'GET', 'callback' => array( __CLASS__, 'feriados_config' ), 'permission_callback' => array( __CLASS__, 'can_manage_catalog' ) ),
				array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'feriados_config_salvar' ), 'permission_callback' => array( __CLASS__, 'can_manage_catalog' ) ),
			)
		);
		register_rest_route( self::NS, '/turmas', array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'criar' ), 'permission_callback' => array( __CLASS__, 'can_create_turma' ) ) );
		register_rest_route( self::NS, '/turmas/(?P<id>[A-Za-z0-9_\-]+)', array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'salvar' ), 'permission_callback' => array( __CLASS__, 'can_edit_turma' ), 'args' => $id ) );
		register_rest_route( self::NS, '/turmas/(?P<id>[A-Za-z0-9_\-]+)/acao', array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'acao' ), 'permission_callback' => array( __CLASS__, 'can_act_turma' ), 'args' => $id ) );
		register_rest_route( self::NS, '/turmas/(?P<id>[A-Za-z0-9_\-]+)/excluir', array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'excluir' ), 'permission_callback' => array( __CLASS__, 'can_delete_turma' ), 'args' => $id ) );
		register_rest_route( self::NS, '/turmas/(?P<id>[A-Za-z0-9_\-]+)/historico', array( 'methods' => 'GET', 'callback' => array( __CLASS__, 'historico' ), 'permission_callback' => array( __CLASS__, 'can_view' ), 'args' => $id ) );
		register_rest_route( self::NS, '/turmas/(?P<id>[A-Za-z0-9_\-]+)/versoes/(?P<n>\d+)', array( 'methods' => 'GET', 'callback' => array( __CLASS__, 'versao' ), 'permission_callback' => array( __CLASS__, 'can_view' ), 'args' => $id ) );
		register_rest_route( self::NS, '/atividade', array( 'methods' => 'GET', 'callback' => array( __CLASS__, 'atividade' ), 'permission_callback' => array( __CLASS__, 'can_view' ) ) );
		register_rest_route( self::NS, '/avisos', array( 'methods' => 'GET', 'callback' => array( __CLASS__, 'avisos' ), 'permission_callback' => array( __CLASS__, 'can_view' ) ) );
		register_rest_route( self::NS, '/avisos/lidos', array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'avisos_lidos' ), 'permission_callback' => array( __CLASS__, 'can_view' ) ) );
		register_rest_route( self::NS, '/avisos/(?P<aid>\d+)/atender', array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'aviso_atender' ), 'permission_callback' => array( __CLASS__, 'can_act_turma' ) ) );
		register_rest_route( self::NS, '/email-teste', array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'email_teste' ), 'permission_callback' => array( __CLASS__, 'can_manage_accounts' ) ) );
		register_rest_route(
			self::NS,
			'/acessos',
			array(
				array( 'methods' => 'GET', 'callback' => array( __CLASS__, 'acessos' ), 'permission_callback' => array( __CLASS__, 'can_manage_accounts' ) ),
				array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'acesso_criar' ), 'permission_callback' => array( __CLASS__, 'can_manage_accounts' ) ),
			)
		);
		register_rest_route( self::NS, '/acessos/(?P<uid>\d+)', array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'acesso_salvar' ), 'permission_callback' => array( __CLASS__, 'can_manage_accounts' ) ) );
		register_rest_route( self::NS, '/acessos/(?P<uid>\d+)/link', array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'acesso_link' ), 'permission_callback' => array( __CLASS__, 'can_manage_accounts' ) ) );
		register_rest_route( self::NS, '/exportar', array( 'methods' => 'GET', 'callback' => array( __CLASS__, 'exportar' ), 'permission_callback' => array( __CLASS__, 'can_export' ) ) );
		register_rest_route( self::NS, '/importar', array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'importar' ), 'permission_callback' => array( __CLASS__, 'can_import' ) ) );
		register_rest_route( self::NS, '/saude', array( 'methods' => 'GET', 'callback' => array( __CLASS__, 'saude' ), 'permission_callback' => array( __CLASS__, 'can_configure' ) ) );
		register_rest_route( self::NS, '/auditoria', array( 'methods' => 'GET', 'callback' => array( __CLASS__, 'auditoria' ), 'permission_callback' => array( __CLASS__, 'can_audit' ) ) );
	}

	public static function can_view() { return '' !== Cronograma_EAD_Service::perfil(); }
	public static function can_create_turma() { return in_array( Cronograma_EAD_Service::perfil(), array( 'equipe', 'unidade' ), true ); }
	public static function can_edit_turma() { return current_user_can( Cronograma_EAD_Roles::CAP_EDIT_TURMAS ); }
	public static function can_act_turma() { return in_array( Cronograma_EAD_Service::perfil(), array( 'equipe', 'unidade' ), true ); }
	public static function can_delete_turma() { return current_user_can( Cronograma_EAD_Roles::CAP_EDIT_TURMAS ) && 'equipe' === Cronograma_EAD_Service::perfil(); }
	public static function can_manage_catalog() { return current_user_can( Cronograma_EAD_Roles::CAP_CATALOG ); }
	public static function can_manage_accounts() { return current_user_can( Cronograma_EAD_Roles::CAP_ACCOUNTS ); }
	public static function can_export() { return current_user_can( Cronograma_EAD_Roles::CAP_EXPORT ); }
	public static function can_import() { return current_user_can( Cronograma_EAD_Roles::CAP_IMPORT ); }
	public static function can_configure() { return current_user_can( Cronograma_EAD_Roles::CAP_CONFIG ); }
	public static function can_audit() { return current_user_can( Cronograma_EAD_Roles::CAP_AUDIT ); }

	private static function out( $v ) {
		if ( is_wp_error( $v ) ) {
			return $v;
		}
		$res = rest_ensure_response( $v );
		$res->header( 'Cache-Control', 'no-store' );
		$res->header( 'X-Cronograma-Request-Id', Cronograma_EAD_Security::request_id() );
		return $res;
	}

	public static function bootstrap() { return self::out( Cronograma_EAD_Service::bootstrap() ); }
	public static function acessos() { return self::out( Cronograma_EAD_Accounts::listar() ); }
	public static function acesso_criar( WP_REST_Request $r ) { return self::out( Cronograma_EAD_Accounts::criar( (array) $r->get_json_params() ) ); }
	public static function acesso_salvar( WP_REST_Request $r ) { return self::out( Cronograma_EAD_Accounts::atualizar( (int) $r['uid'], (array) $r->get_json_params() ) ); }
	public static function acesso_link( WP_REST_Request $r ) { return self::out( Cronograma_EAD_Accounts::novo_link( (int) $r['uid'], (array) $r->get_json_params() ) ); }
	public static function catalogo( WP_REST_Request $r ) { return self::out( Cronograma_EAD_Service::salvar_catalogo( $r->get_json_params() ) ); }
	public static function feriados_nacionais( WP_REST_Request $r ) { return self::out( Cronograma_EAD_Service::feriados_nacionais( (int) $r['ano'] ) ); }
	public static function municipios( WP_REST_Request $r ) { return self::out( Cronograma_EAD_Service::municipios_uf( (string) $r['uf'] ) ); }
	public static function feriados_local( WP_REST_Request $r ) { return self::out( Cronograma_EAD_Service::feriados_local( (string) $r['id'], (int) $r['ano'] ) ); }
	public static function feriados_config() { return self::out( Cronograma_EAD_Service::feriados_config() ); }
	public static function feriados_config_salvar( WP_REST_Request $r ) { return self::out( Cronograma_EAD_Service::feriados_config_salvar( (array) $r->get_json_params() ) ); }
	public static function criar( WP_REST_Request $r ) { return self::out( Cronograma_EAD_Service::criar( (array) $r->get_json_params() ) ); }
	public static function salvar( WP_REST_Request $r ) { return self::out( Cronograma_EAD_Service::salvar( $r['id'], (array) $r->get_json_params() ) ); }
	public static function acao( WP_REST_Request $r ) { return self::out( Cronograma_EAD_Service::acao( $r['id'], (array) $r->get_json_params() ) ); }
	public static function excluir( WP_REST_Request $r ) { return self::out( Cronograma_EAD_Service::excluir( $r['id'] ) ); }
	public static function historico( WP_REST_Request $r ) { return self::out( Cronograma_EAD_Service::historico( $r['id'] ) ); }
	public static function avisos() { return self::out( Cronograma_EAD_Avisos::listar() ); }
	public static function avisos_lidos( WP_REST_Request $r ) { return self::out( Cronograma_EAD_Avisos::marcar_lidos( (array) $r->get_json_params() ) ); }
	public static function aviso_atender( WP_REST_Request $r ) { return self::out( Cronograma_EAD_Avisos::atender( (int) $r['aid'] ) ); }
	public static function email_teste() { return self::out( Cronograma_EAD_Service::email_teste() ); }
	public static function atividade() { return self::out( Cronograma_EAD_Service::atividade() ); }
	public static function versao( WP_REST_Request $r ) { return self::out( Cronograma_EAD_Service::versao( $r['id'], (int) $r['n'] ) ); }
	public static function exportar() { return self::out( Cronograma_EAD_Service::exportar() ); }
	public static function importar( WP_REST_Request $r ) { return self::out( Cronograma_EAD_Service::importar( (array) $r->get_json_params() ) ); }
	public static function saude() { return self::out( Cronograma_EAD_Service::saude() ); }
	public static function auditoria( WP_REST_Request $r ) { return self::out( Cronograma_EAD_Service::auditoria( (int) $r->get_param( 'limit' ) ) ); }
}
