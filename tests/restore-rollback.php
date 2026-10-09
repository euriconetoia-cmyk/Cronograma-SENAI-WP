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
		$rows = $wpdb->get_results( "SELECT * FROM $table", ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL
		if ( ! is_array( $rows ) ) {
			WP_CLI::error( 'Falha ao consultar tabela ' . $name );
		}
		// A ordem física de SELECT sem ORDER BY não é garantida pelo SQL.
		// Ordenar representações canônicas permite comparar conteúdo real.
		$normalized = array_map( 'wp_json_encode', $rows );
		sort( $normalized, SORT_STRING );
		$all[ $name ] = $normalized;
	}
	return $all;
};
$tables_before = $read_tables();
$sim = Cronograma_EAD_Service::importar( array_merge( $backup, array( 'simular' => true ) ) );
if ( is_wp_error( $sim ) || empty( $sim['confirmacao'] ) ) {
	WP_CLI::error( 'Simulação de restauração falhou.' );
}
// Injeção de falha ao iniciar transação: nenhuma modificação de catálogo ou tabelas.
$begin_hits = 0;
$block_begin = static function ( $sql ) use ( &$begin_hits ) {
	if ( preg_match( '/^\\s*START\\s+TRANSACTION\\b/i', $sql ) ) {
		++$begin_hits;
		return 'SQL_INVALIDO_APENAS_TESTE_BEGIN';
	}
	return $sql;
};
add_filter( 'query', $block_begin );
$begin_result = Cronograma_EAD_Service::importar( array_merge( $backup, array(
	'simular' => false,
	'rev' => $before['rev'],
	'confirmacao' => $sim['confirmacao'],
) ) );
remove_filter( 'query', $block_begin );
if ( 0 === $begin_hits || ! is_wp_error( $begin_result ) || 'cronograma_ead_transacao' !== $begin_result->get_error_code() ) {
	WP_CLI::error( 'Falha forçada de START TRANSACTION não interrompeu a importação.' );
}
if ( $before !== Cronograma_EAD_Store::get() || $tables_before !== $read_tables() ) {
	WP_CLI::error( 'Falha no início da transação alterou dados do sistema.' );
}
WP_CLI::log( 'OK falha de START TRANSACTION sem alteração de dados.' );

// Força falha na confirmação da transação, após as gravações do backup.
$commit_hits = 0;
$block_commit = static function ( $sql ) use ( &$commit_hits ) {
	if ( preg_match( '/^\\s*COMMIT\\b/i', $sql ) ) {
		++$commit_hits;
		return 'SQL_INVALIDO_APENAS_TESTE_COMMIT';
	}
	return $sql;
};
add_filter( 'query', $block_commit );
$commit_result = Cronograma_EAD_Service::importar( array_merge( $backup, array(
	'simular' => false,
	'rev' => $before['rev'],
	'confirmacao' => $sim['confirmacao'],
) ) );
remove_filter( 'query', $block_commit );
if ( 0 === $commit_hits || ! is_wp_error( $commit_result ) || 'cronograma_ead_importacao' !== $commit_result->get_error_code() ) {
	WP_CLI::error( 'Falha forçada de COMMIT não interrompeu corretamente a importação.' );
}
$after_commit_catalog = Cronograma_EAD_Store::get();
$after_commit_tables = $read_tables();
if ( $before !== $after_commit_catalog || $tables_before !== $after_commit_tables ) {
	WP_CLI::warning( 'Diferenças após falha de COMMIT: catálogo=' . ( $before === $after_commit_catalog ? 'igual' : 'diferente' ) );
	foreach ( $tables as $table_name ) {
		if ( $tables_before[ $table_name ] !== $after_commit_tables[ $table_name ] ) {
			WP_CLI::warning( 'Diferença na tabela ' . $table_name . ': antes=' . count( $tables_before[ $table_name ] ) . ', depois=' . count( $after_commit_tables[ $table_name ] ) );
		}
	}
	WP_CLI::error( 'Falha no COMMIT não preservou integralmente os dados.' );
}
WP_CLI::log( 'OK falha de COMMIT com rollback íntegro.' );

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
if ( ! is_wp_error( $result ) || 'cronograma_ead_restauracao' !== $result->get_error_code() ) {
	WP_CLI::error( 'A restauração deveria ter sido interrompida pelo erro do histórico. Resultado: ' . ( is_wp_error( $result ) ? $result->get_error_code() . ': ' . $result->get_error_message() : wp_json_encode( $result ) ) );
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
