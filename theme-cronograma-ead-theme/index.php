<?php
/**
 * Modelo padrão (listas, 404 e artigos).
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
get_header();
?>
<main id="conteudo" class="ct-main ct-narrow">
<?php if ( have_posts() ) : ?>
	<?php
	while ( have_posts() ) :
		the_post();
		?>
		<article <?php post_class( 'ct-card' ); ?> style="margin-bottom:16px">
			<h2 class="ct-title"><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h2>
			<div class="entry-content"><?php the_excerpt(); ?></div>
		</article>
	<?php endwhile; ?>
	<?php the_posts_pagination(); ?>
<?php else : ?>
	<h1 class="ct-title">Página não encontrada</h1>
	<p>Não há nada neste endereço. <a href="<?php echo esc_url( home_url( '/' ) ); ?>">Voltar ao início</a>.</p>
<?php endif; ?>
</main>
<?php get_footer(); ?>
