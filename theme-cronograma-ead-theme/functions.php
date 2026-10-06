<?php
/**
 * Tema Cronogramas EaD.
 *
 * O tema cuida da aparência. Os dados e as telas do sistema vêm do plugin
 * "Cronogramas EaD (Núcleo)".
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'CT_VERSION', '1.4.0' );

function ct_plugin_ativo() {
	return defined( 'CRONOGRAMA_EAD_VERSION' ) && class_exists( 'Cronograma_EAD_Pages' );
}

add_action(
	'after_setup_theme',
	function () {
		add_theme_support( 'title-tag' );
		add_theme_support( 'html5', array( 'search-form', 'gallery', 'caption', 'style', 'script' ) );
		add_theme_support( 'responsive-embeds' );
		register_nav_menus( array( 'principal' => 'Menu principal' ) );
	}
);

add_action(
	'wp_enqueue_scripts',
	function () {
		// Fontes externas ficam desativadas por padrão. Podem ser habilitadas explicitamente por filtro.
		if ( apply_filters( 'cronograma_ead_fontes_google', false ) ) {
			wp_enqueue_style(
				'ct-fontes',
				'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Sans+Condensed:wght@500;600&family=IBM+Plex+Mono:wght@400;500&display=swap',
				array(),
				null
			);
		}
		wp_enqueue_style( 'ct-estilo', get_stylesheet_uri(), array(), CT_VERSION );
		wp_enqueue_script( 'ct-tema-boot', get_template_directory_uri() . '/assets/theme-boot.js', array(), CT_VERSION, false );
		wp_enqueue_script( 'ct-tema', get_template_directory_uri() . '/assets/theme.js', array(), CT_VERSION, true );
	}
);

/** Aviso no painel quando o plugin do sistema não está ativo. */
add_action(
	'admin_notices',
	function () {
		if ( ct_plugin_ativo() || ! current_user_can( 'activate_plugins' ) ) {
			return;
		}
		echo '<div class="notice notice-warning"><p><strong>Tema Cronogramas EaD:</strong> ative o plugin <em>Cronogramas EaD (Núcleo)</em> para criar as páginas e liberar o sistema. <a href="' . esc_url( admin_url( 'plugins.php' ) ) . '">Ir para Plugins</a></p></div>';
	}
);

/**
 * Ao ativar o tema: cria o menu "Sistema" com as páginas do plugin e liga ao local "Menu principal".
 * Só mexe no menu se nenhum menu estiver ligado a esse local.
 */
add_action(
	'after_switch_theme',
	function () {
		if ( ! ct_plugin_ativo() ) {
			return;
		}
		$locais = get_nav_menu_locations();
		if ( ! empty( $locais['principal'] ) ) {
			return;
		}
		$nome = 'Sistema de cronogramas';
		$menu = wp_get_nav_menu_object( $nome );
		$id   = $menu ? (int) $menu->term_id : (int) wp_create_nav_menu( $nome );
		if ( ! $id || is_wp_error( $id ) ) {
			return;
		}
		if ( ! $menu ) {
			foreach ( Cronograma_EAD_Pages::ids() as $page_id ) {
				wp_update_nav_menu_item(
					$id,
					0,
					array(
						'menu-item-object-id' => $page_id,
						'menu-item-object'    => 'page',
						'menu-item-type'      => 'post_type',
						'menu-item-status'    => 'publish',
					)
				);
			}
		}
		$locais['principal'] = $id;
		set_theme_mod( 'nav_menu_locations', $locais );
	}
);

/** Menu de reserva: páginas do sistema (ou todas as páginas) quando nenhum menu foi montado. */
function ct_menu_reserva() {
	$itens = array();
	if ( ct_plugin_ativo() ) {
		foreach ( Cronograma_EAD_Pages::urls() as $view => $url ) {
			if ( 'cronograma' !== $view && ! current_user_can( 'cronograma_ead_gerir_catalogo' ) ) {
				continue;
			}
			$def     = Cronograma_EAD_Pages::definitions();
			$itens[] = '<li><a href="' . esc_url( $url ) . '">' . esc_html( $def[ $view ][0] ) . '</a></li>';
		}
	}
	if ( $itens ) {
		echo '<ul class="ct-nav">' . implode( '', $itens ) . '</ul>'; // phpcs:ignore WordPress.Security.EscapeOutput
		return;
	}
	wp_page_menu( array( 'menu_class' => 'ct-nav', 'container' => false ) );
}

/**
 * O sistema tem navegação própria por dentro. No menu do tema, só a equipe vê todas as páginas;
 * unidades escolares e consulta veem apenas "Cronograma".
 */
add_filter(
	'wp_nav_menu_objects',
	function ( $itens ) {
		if ( ! ct_plugin_ativo() || current_user_can( 'cronograma_ead_gerir_catalogo' ) ) {
			return $itens;
		}
		$ids  = Cronograma_EAD_Pages::ids();
		$home = isset( $ids['cronograma'] ) ? (int) $ids['cronograma'] : 0;
		return array_values(
			array_filter(
				$itens,
				function ( $i ) use ( $ids, $home ) {
					$oid = (int) $i->object_id;
					return ! in_array( $oid, array_map( 'intval', $ids ), true ) || $oid === $home;
				}
			)
		);
	}
);

/** Fora do painel, o nome do site é sempre Unidigit@l (título das páginas, feeds, e-mails), qualquer que seja o configurado em Configurações. */
add_filter(
	'option_blogname',
	function ( $nome ) {
		return is_admin() ? $nome : 'Unidigit@l';
	}
);
