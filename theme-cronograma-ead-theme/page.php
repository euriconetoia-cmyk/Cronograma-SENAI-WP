<?php
/**
 * Páginas. As que têm o shortcode do sistema usam largura total.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
get_header();
?>
<main id="conteudo" class="ct-main <?php echo ( ! empty( get_post()->post_content ) && has_shortcode( get_post()->post_content, 'cronograma_ead' ) ) ? '' : 'ct-narrow'; ?>">
<?php
while ( have_posts() ) :
	the_post();
	$sistema = has_shortcode( get_post()->post_content, 'cronograma_ead' );
	?>
	<article <?php post_class(); ?>>
		<h1 class="<?php echo $sistema ? 'ct-app-title' : 'ct-title'; ?>"><?php the_title(); ?></h1>
		<div class="entry-content <?php echo $sistema ? 'ct-app-wrap' : ''; ?>">
			<?php the_content(); ?>
		</div>
	</article>
<?php endwhile; ?>
</main>
<?php get_footer(); ?>
