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
			$css_ver = file_exists( CRONOGRAMA_EAD_DIR . 'assets/login-gateway.css' ) ? (string) filemtime( CRONOGRAMA_EAD_DIR . 'assets/login-gateway.css' ) : CRONOGRAMA_EAD_VERSION;
			wp_enqueue_style( 'cronograma-ead-login-gateway', CRONOGRAMA_EAD_URL . 'assets/login-gateway.css', array(), $css_ver );
			$redirect = get_permalink();
			ob_start();
			?>
			<section class="ce-login-gateway" aria-labelledby="ce-login-title">
				<div class="ce-login-shell">
					<div class="ce-login-brand">
						<img class="ce-login-logo" src="<?php echo esc_url( CRONOGRAMA_EAD_URL . 'assets/img/senai-logo.png' ); ?>" alt="SENAI">
						<span class="ce-login-kicker">Unidigit@l · Ambiente institucional</span>
						<h1 id="ce-login-title">Cronogramas EaD</h1>
						<p>Planeje, valide e acompanhe os cronogramas das turmas em um único ambiente, com regras específicas para cada modelo de curso.</p>
						<ul class="ce-login-points" aria-label="Recursos do sistema">
							<li><span class="ce-login-dot"></span><span>Gestão de turmas, cursos e unidades.</span></li>
							<li><span class="ce-login-dot"></span><span>Validação de datas, feriados e momentos síncronos.</span></li>
							<li><span class="ce-login-dot"></span><span>Acesso controlado por perfil e unidade.</span></li>
						</ul>
					</div>
					<div class="ce-login-panel">
						<h2>Acesse o sistema</h2>
						<p class="ce-login-sub">Use seu usuário ou e-mail institucional e sua senha.</p>
						<div class="ce-login-form">
						<?php
						wp_login_form(
							array(
								'echo'           => true,
								'redirect'       => $redirect,
								'label_username' => 'Usuário ou e-mail',
								'label_password' => 'Senha',
								'label_remember' => 'Lembrar de mim',
								'label_log_in'   => 'Entrar',
								'remember'       => true,
							)
						);
						?>
						</div>
						<div class="ce-login-actions">
							<a href="<?php echo esc_url( wp_lostpassword_url( $redirect ) ); ?>">Esqueceu sua senha?</a>
							<a href="<?php echo esc_url( home_url( '/' ) ); ?>">Voltar ao início</a>
						</div>
						<p class="ce-login-security"><strong>Acesso restrito.</strong> O uso do sistema é destinado à equipe Unidigit@l e às unidades autorizadas. Em caso de primeiro acesso, utilize o link recebido por e-mail para definir sua senha.</p>
					</div>
				</div>
			</section>
			<?php
			return ob_get_clean();
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
