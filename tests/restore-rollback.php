<?php
/**
 * Teste de recuperação em WordPress descartável. Não executar em produção.
 *
 * Executado com: wp eval-file /tmp/ce-tests/restore-rollback.php
 * Injeta erro SQL somente na tabela de versões enquanto a restauração ocorre.
 */
if ( ! defined( 'WP_CLI' ) || ! WP_CLI ) {
	exit( "Execute somente no WP-CLI do ambiente E2E.\n" );
}
if ( false === strpos( home_url(), '127.0.0.1' ) && false === strpos( home_url(), 'localhost' ) ) {
	WP_CLI::error( 'Proteção: teste destrutivo permitido somente no WordPress local do CI.' );
}
$admin = get_user_by( 'login', 'admin' );
if ( ! $admin ) {
	WP_CLI::error( 'Administrador de testes inexistente.' );
}
wp_set_current_user( $admin->ID );
$before = Cronograma_EAD_Store::get();
$backup = Cronograma_EAD_Service::exportar();
$with_versions = array_filter( $backup['turmas'], static function ( $t ) {
	return ! empty( $t['vigente']['versao'] );
} );
if ( ! $with_versions ) {
	WP_CLI::error( 'Pré-condição: não há turmas validadas com snapshot para injetar falha.' );
}
$tables = array( 'turmas', 'versoes', 'log', 'avisos' );
$read_tables = static function () use ( $tables ) {
	global $wpdb;
	$all = array();
	foreach ( $tables as $name ) {
		$table = Cronograma_EAD_DB::t( $name );
		$all[ $name ] = $wpdb->get_results( "SELECT * FROM $table", ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL
	}
	return $all;
};
$tables_before = $read_tables();
$sim = Cronograma_EAD_Service::importar( array_merge( $backup, array( 'simular' => true ) ) );
if ( is_wp_error( $sim ) || empty( $sim['confirmacao'] ) ) {
	WP_CLI::error( 'Simulação de restauração falhou.' );
}
$injected = 0;
$injector = static function ( $sql ) use ( &$injected ) {
	if ( preg_match( '/^\\s*INSERT\\s+INTO\\s+[`"]?\\w*ce_versoes[`"]?/i', $sql ) ) {
		++$injected;
		return 'SQL_INVALIDO_APENAS_TESTE_RESTAURACAO';
	}
	return $sql;
};
add_filter( 'query', $injector );
$result = Cronograma_EAD_Service::importar( array_merge( $backup, array(
	'simular' => false,
	'rev' => $before['rev'],
	'confirmacao' => $sim['confirmacao'],
) ) );
remove_filter( 'query', $injector );
if ( 0 === $injected ) {
	WP_CLI::error( 'O mecanismo de injeção não atingiu o INSERT do histórico.' );
}
if ( ! is_wp_error( $result ) || 'restauracao' !== $result->get_error_code() ) {
	WP_CLI::error( 'A restauração deveria ter sido interrompida pelo erro do histórico.' );
}
$after = Cronograma_EAD_Store::get();
if ( $before !== $after ) {
	WP_CLI::error( 'Rollback não preservou integralmente o catálogo/revisão.' );
}
$tables_after = $read_tables();
foreach ( $tables as $name ) {
	if ( $tables_before[ $name ] !== $tables_after[ $name ] ) {
		WP_CLI::error( 'Rollback não preservou integralmente a tabela ' . $name );
	}
}
WP_CLI::success( 'Falha de histórico injetada e rollback de catálogo, turmas, versões, log e avisos confirmado.' );
