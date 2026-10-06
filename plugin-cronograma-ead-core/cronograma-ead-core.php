<?php
/**
 * Plugin Name:       Cronogramas EaD (Núcleo)
 * Description:       Cadastro de cursos, turmas, equipe e feriados que gera o cronograma EaD com prazos por dias úteis, com fluxo de validação pela unidade escolar, histórico, versões e exportação em Excel e PDF.
 * Version:           2.19.0
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            Unidigit@l
 * License:           GPL-2.0-or-later
 * Text Domain:       cronograma-ead
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// Se outra cópia deste plugin já foi carregada (por exemplo, instalada em outra pasta), não carrega de novo:
// carregar duas vezes causa "erro crítico" por classes e constantes repetidas.
if ( defined( 'CRONOGRAMA_EAD_VERSION' ) ) {
	add_action( 'admin_notices', function () {
		echo '<div class="notice notice-error"><p><b>Cronogramas EaD:</b> há duas cópias do plugin instaladas. Desative e exclua a mais antiga em Plugins.</p></div>';
	} );
	return;
}

define( 'CRONOGRAMA_EAD_VERSION', '2.19.0' );
define( 'CRONOGRAMA_EAD_FILE', __FILE__ );
define( 'CRONOGRAMA_EAD_DIR', plugin_dir_path( __FILE__ ) );
define( 'CRONOGRAMA_EAD_URL', plugin_dir_url( __FILE__ ) );

foreach ( array( 'rules', 'security', 'privacy', 'store', 'avisos', 'db', 'roles', 'users', 'accounts', 'login', 'pages', 'notify', 'service', 'rest', 'shortcode', 'admin' ) as $cead_f ) {
	require_once CRONOGRAMA_EAD_DIR . 'includes/class-' . $cead_f . '.php';
}
unset( $cead_f );

/**
 * Classe principal. Serve também para o tema detectar que o plugin está ativo.
 */
final class Cronograma_EAD_Plugin {

	public static function init() {
		// Só no 'init': antes disso o WordPress ainda não montou as regras de links nem os tipos de conteúdo.
		add_action( 'init', array( __CLASS__, 'maybe_upgrade' ), 99 );
		add_action( 'rest_api_init', array( 'Cronograma_EAD_REST', 'register' ) );
		add_action( 'init', array( 'Cronograma_EAD_Shortcode', 'register' ) );
		add_action( 'admin_menu', array( 'Cronograma_EAD_Admin', 'menu' ) );
		add_action( 'admin_post_cronograma_ead_pages', array( 'Cronograma_EAD_Admin', 'handle_pages' ) );
		add_action( 'admin_post_cronograma_ead_seed', array( 'Cronograma_EAD_Admin', 'handle_seed' ) );
		add_action( 'admin_post_cronograma_ead_export', array( 'Cronograma_EAD_Admin', 'handle_export' ) );
		add_action( 'admin_post_cronograma_ead_settings', array( 'Cronograma_EAD_Admin', 'handle_settings' ) );
		add_action( 'admin_notices', function () {
			$erro = get_option( 'cronograma_ead_erro' );
			if ( $erro && current_user_can( 'manage_options' ) ) {
				echo '<div class="notice notice-error"><p><b>Cronogramas EaD:</b> falha ao preparar o plugin: ' . esc_html( $erro ) . '</p></div>';
			}
		} );
		add_action( 'cronograma_ead_diario', array( 'Cronograma_EAD_Notify', 'diario' ) );
		Cronograma_EAD_Users::hooks();
		Cronograma_EAD_Accounts::hooks();
		Cronograma_EAD_Login::hooks();
		Cronograma_EAD_Privacy::hooks();
		// Ícone da aba: logo da SENAI, a menos que o site já tenha um ícone próprio.
		add_filter( 'get_site_icon_url', function ( $url ) {
			return $url ? $url : CRONOGRAMA_EAD_URL . 'assets/img/favicon.png';
		} );
	}

	/** Roda na ativação. */
	public static function activate() {
		self::preparar();
		flush_rewrite_rules();
	}

	public static function deactivate() {
		wp_clear_scheduled_hook( 'cronograma_ead_diario' );
	}

	private static function preparar() {
		Cronograma_EAD_DB::install();
		Cronograma_EAD_Service::migrar_v1();
		Cronograma_EAD_Roles::install();
		Cronograma_EAD_Store::seed_if_empty();
		Cronograma_EAD_Pages::ensure_all();
		if ( ! wp_next_scheduled( 'cronograma_ead_diario' ) ) {
			wp_schedule_event( time() + 300, 'daily', 'cronograma_ead_diario' );
		}
		update_option( 'cronograma_ead_version', CRONOGRAMA_EAD_VERSION, false );
	}

	/** Garante tabelas, papéis e páginas depois de atualizações do plugin. */
	public static function maybe_upgrade() {
		if ( get_option( 'cronograma_ead_version' ) === CRONOGRAMA_EAD_VERSION && get_option( Cronograma_EAD_DB::OPT ) === Cronograma_EAD_DB::VERSION ) {
			return;
		}
		try {
			self::preparar();
			delete_option( 'cronograma_ead_erro' );
		} catch ( \Throwable $e ) {
			// Nunca derruba o site: guarda o erro e mostra no painel.
			update_option( 'cronograma_ead_erro', $e->getMessage() . ' (' . basename( $e->getFile() ) . ':' . $e->getLine() . ')', false );
		}
	}
}

register_activation_hook( __FILE__, array( 'Cronograma_EAD_Plugin', 'activate' ) );
register_deactivation_hook( __FILE__, array( 'Cronograma_EAD_Plugin', 'deactivate' ) );
Cronograma_EAD_Plugin::init();
