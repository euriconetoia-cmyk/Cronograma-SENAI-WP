<?php
/**
 * Ao excluir o plugin: remove os papéis, permissões e a rotina diária.
 * Os dados (tabelas, catálogo, vínculos de usuários) e as páginas são mantidos de propósito.
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

wp_clear_scheduled_hook( 'cronograma_ead_diario' );
require_once plugin_dir_path( __FILE__ ) . 'includes/class-roles.php';
Cronograma_EAD_Roles::remove();
