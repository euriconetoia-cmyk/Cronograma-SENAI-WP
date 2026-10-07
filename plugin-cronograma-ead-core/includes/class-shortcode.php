<?php
/**
 * Shortcode [cronograma_ead view="cronograma|turmas|cursos|equipe|unidades|feriados|backup"]
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Cronograma_EAD_Shortcode {

	public static function register() {
		add_shortcode( 'cronograma_ead', array( __CLASS__, 'render' ) );
	}

	public static function render( $atts ) {
		$atts = shortcode_atts( array( 'view' => 'cronograma' ), $atts, 'cronograma_ead' );
		$view = array_key_exists( $atts['view'], Cronograma_EAD_Pages::definitions() ) ? $atts['view'] : 'cronograma';

		if ( ! is_user_logged_in() ) {
			return '<div class="ce-aviso"><p>Entre com seu usuário para acessar o sistema de cronogramas.</p><p><a class="button" href="' . esc_url( wp_login_url( get_permalink() ) ) . '">Entrar</a></p></div>';
		}
		$perfil = Cronograma_EAD_Service::perfil();
		if ( '' === $perfil ) {
			return '<div class="ce-aviso"><p>Seu usuário não tem permissão para ver os cronogramas. Peça acesso à Unidigit@l.</p></div>';
		}
		if ( 'equipe' !== $perfil && ! Cronograma_EAD_Service::unidades_do_usuario() ) {
			return '<div class="ce-aviso"><p>Seu usuário ainda não está ligado a nenhuma unidade escolar. Peça à Unidigit@l para fazer essa ligação.</p></div>';
		}

		$dir = CRONOGRAMA_EAD_DIR . 'assets/';
		$ver = file_exists( $dir . 'app.js' ) ? (string) filemtime( $dir . 'app.js' ) : CRONOGRAMA_EAD_VERSION;
		wp_enqueue_script( 'cronograma-ead-app', CRONOGRAMA_EAD_URL . 'assets/app.js', array(), $ver, true );
		$turma = isset( $_GET['turma'] ) ? sanitize_text_field( wp_unslash( $_GET['turma'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification
		wp_add_inline_script(
			'cronograma-ead-app',
			'window.CRONOGRAMA_EAD = ' . wp_json_encode(
				array(
					'rest'   => esc_url_raw( rest_url( Cronograma_EAD_REST::NS . '/' ) ),
					'nonce'  => wp_create_nonce( 'wp_rest' ),
					'pages'  => Cronograma_EAD_Pages::urls(),
					'perfil' => $perfil,
					'view'   => $view,
					'turma'  => Cronograma_EAD_Store::valid_id( $turma ) ? $turma : '',
					'logout' => wp_logout_url( home_url( '/' ) ),
					'fontes' => (bool) apply_filters( 'cronograma_ead_fontes_google', false ),
				)
			) . ';',
			'before'
		);

		return '<div id="cronograma-ead-app" class="ce-app" data-view="' . esc_attr( $view ) . '"><noscript>Ative o JavaScript para usar o sistema de cronogramas.</noscript></div>';
	}
}
