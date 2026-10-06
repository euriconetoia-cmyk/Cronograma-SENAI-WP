<?php
/**
 * Página inicial: quem está logado vai direto ao Cronograma; os demais veem o convite para entrar.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( is_user_logged_in() && ct_plugin_ativo() && current_user_can( 'cronograma_ead_ver' ) ) {
	$urls = Cronograma_EAD_Pages::urls();
	if ( ! empty( $urls['cronograma'] ) ) {
		wp_safe_redirect( $urls['cronograma'] );
		exit;
	}
}
get_header();
?>
<main id="conteudo" class="ct-main ct-narrow">
	<h1 class="ct-title">Unidigit@l</h1>
	<div class="ct-card">
		<?php if ( ! is_user_logged_in() ) : ?>
			<p>Sistema de cronogramas EaD. Entre com seu usuário para cadastrar cursos e turmas e gerar o cronograma.</p>
			<p><a class="ct-btn" href="<?php echo esc_url( wp_login_url( home_url( '/' ) ) ); ?>">Entrar</a></p>
		<?php elseif ( ! ct_plugin_ativo() ) : ?>
			<p>O plugin <strong>Cronogramas EaD (Núcleo)</strong> não está ativo. Ative-o em Plugins para liberar o sistema.</p>
		<?php else : ?>
			<p>Seu usuário ainda não tem permissão para ver os cronogramas. Peça acesso à administração do site.</p>
		<?php endif; ?>
	</div>
</main>
<?php get_footer(); ?>
