<?php
/**
 * Páginas do sistema. Cada uma recebe o shortcode [cronograma_ead view="..."].
 *
 * Estrutura criada:
 *   Cronograma            (/cronograma/)
 *     Início              (/cronograma/inicio/)
 *     Turmas              (/cronograma/turmas/)
 *     Cursos              (/cronograma/cursos/)
 *     Equipe              (/cronograma/equipe/)
 *     Acessos             (/cronograma/acessos/)
 *     Unidades            (/cronograma/unidades/)
 *     Feriados            (/cronograma/feriados/)
 *     Backup              (/cronograma/backup/)
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Cronograma_EAD_Pages {

	const OPT = 'cronograma_ead_pages';

	/** view => [título, slug] — a primeira é a página-mãe. */
	public static function definitions() {
		return array(
			'cronograma' => array( 'Cronograma', 'cronograma' ),
			'inicio'     => array( 'Início', 'inicio' ),
			'turmas'     => array( 'Turmas', 'turmas' ),
			'cursos'     => array( 'Cursos', 'cursos' ),
			'equipe'     => array( 'Equipe', 'equipe' ),
			'acessos'    => array( 'Acessos', 'acessos' ),
			'unidades'   => array( 'Unidades', 'unidades' ),
			'feriados'   => array( 'Feriados', 'feriados' ),
			'backup'     => array( 'Backup', 'backup' ),
		);
	}

	/** @return array<string,int> view => ID da página */
	public static function ids() {
		$ids = get_option( self::OPT, array() );
		return is_array( $ids ) ? $ids : array();
	}

	/** Cria as páginas que faltam (ou foram para a lixeira) e guarda os IDs. */
	public static function ensure_all() {
		$ids    = self::ids();
		$parent = 0;
		$order  = 0;
		foreach ( self::definitions() as $view => $def ) {
			$order++;
			$id   = isset( $ids[ $view ] ) ? (int) $ids[ $view ] : 0;
			$post = $id ? get_post( $id ) : null;
			if ( ! $post || 'trash' === $post->post_status || 'page' !== $post->post_type ) {
				$id = wp_insert_post(
					array(
						'post_type'    => 'page',
						'post_status'  => 'publish',
						'post_title'   => $def[0],
						'post_name'    => $def[1],
						'post_parent'  => ( 'cronograma' === $view ) ? 0 : $parent,
						'menu_order'   => $order,
						'post_content' => '[cronograma_ead view="' . $view . '"]',
					)
				);
				if ( is_wp_error( $id ) || ! $id ) {
					continue;
				}
			}
			$ids[ $view ] = (int) $id;
			if ( 'cronograma' === $view ) {
				$parent = (int) $id;
			}
		}
		update_option( self::OPT, $ids, false );
		return $ids;
	}

	/** @return array<string,string> view => URL */
	public static function urls() {
		$urls = array();
		foreach ( self::ids() as $view => $id ) {
			$link = get_permalink( $id );
			if ( $link && 'publish' === get_post_status( $id ) ) {
				$urls[ $view ] = $link;
			}
		}
		return $urls;
	}
}
