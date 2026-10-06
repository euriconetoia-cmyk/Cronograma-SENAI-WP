<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?><!doctype html>
<html <?php language_attributes(); ?>>
<head>
<meta charset="<?php bloginfo( 'charset' ); ?>">
<meta name="viewport" content="width=device-width, initial-scale=1">
<?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>
<a class="ct-skip" href="#conteudo">Ir para o conteúdo</a>
<?php if ( ! ct_plugin_ativo() && current_user_can( 'activate_plugins' ) ) : ?>
	<div class="ct-notice">Ative o plugin <strong>Cronogramas EaD (Núcleo)</strong> para liberar o sistema. <a href="<?php echo esc_url( admin_url( 'plugins.php' ) ); ?>">Plugins</a></div>
<?php endif; ?>
<?php
// Nas páginas do sistema (shortcode), o próprio sistema já mostra o logo, o menu e o usuário: não repetimos o cabeçalho do tema.
$ct_post    = is_singular() ? get_post() : null;
$ct_sistema = $ct_post && has_shortcode( $ct_post->post_content, 'cronograma_ead' );
if ( ! $ct_sistema ) :
?>
<header class="ct-header">
	<div class="ct-header-in">
		<a class="ct-brand" href="<?php echo esc_url( home_url( '/' ) ); ?>">
			<img class="ct-logo" src="<?php echo esc_url( get_template_directory_uri() . '/assets/img/senai-logo-branco.png' ); ?>" alt="SENAI" width="108" height="29">
			<span class="ct-brand-txt"><small>SENAI</small>Unidigit@l</span>
		</a>
		<nav aria-label="Principal">
			<?php
			wp_nav_menu(
				array(
					'theme_location' => 'principal',
					'container'      => false,
					'menu_class'     => 'ct-nav',
					'fallback_cb'    => 'ct_menu_reserva',
					'depth'          => 1,
				)
			);
			?>
		</nav>
		<div class="ct-user">
			<?php if ( is_user_logged_in() ) : ?>
				<span><?php echo esc_html( wp_get_current_user()->display_name ); ?></span>
				<a href="<?php echo esc_url( wp_logout_url( home_url( '/' ) ) ); ?>">Sair</a>
			<?php else : ?>
				<a href="<?php echo esc_url( wp_login_url( home_url( '/' ) ) ); ?>">Entrar</a>
			<?php endif; ?>
			<button type="button" class="ct-toggle" id="ct-toggle" aria-label="Alternar entre tema claro e escuro">Claro / escuro</button>
		</div>
	</div>
</header>
<?php endif; ?>
