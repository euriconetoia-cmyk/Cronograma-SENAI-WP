<?php
/**
 * Integração de feriados com HTTP sintético no WordPress descartável.
 * Nunca efetuar consultas externas reais neste teste.
 */
if ( ! defined( 'WP_CLI' ) || ! WP_CLI ) {
	exit( "Requer WP-CLI.\n" );
}
if ( false === strpos( home_url(), '127.0.0.1' ) && false === strpos( home_url(), 'localhost' ) ) {
	WP_CLI::error( 'Execute somente no WordPress local descartável.' );
}
$unit = 'test-feriados-' . substr( md5( (string) microtime( true ) ), 0, 10 );
$year = 2097;
$ibge = '5208707';
$uf = 'GO';
$original = Cronograma_EAD_Store::get();
$fake = $original['data'];
$fake['unidades'][] = array( 'id' => $unit, 'nome' => 'Teste feriados', 'cidade' => 'Goiânia', 'estado' => $uf, 'codigoIbge' => $ibge );
$catalog_json = wp_json_encode( $fake );
$filter_catalog = static function () use ( $catalog_json ) { return $catalog_json; };
$filter_key = static function () { return 'chave-sintetica-nao-real'; };
add_filter( 'pre_option_' . Cronograma_EAD_Store::OPT_DATA, $filter_catalog );
add_filter( 'pre_option_cronograma_ead_feriados_api_key', $filter_key );
$national_key = 'cronograma_ead_feriados_br_' . $year;
$local_key = 'cronograma_ead_feriados_local_' . md5( $unit . '|' . $year . '|' . $uf . '|' . $ibge );
set_transient( $national_key, array( array( '2097-01-01', 'Nacional sintético' ) ), 3600 );
$requests = 0;
$interceptor = static function ( $pre, $args, $url ) use ( &$requests ) {
	if ( false !== strpos( $url, 'brasilapi.com.br/api/feriados/' ) || false !== strpos( $url, 'feriadosapi.com/api/v1/feriados/cidade/' ) ) {
		++$requests;
		return array( 'headers' => array(), 'body' => '{ resposta invalida', 'response' => array( 'code' => 200, 'message' => 'OK' ), 'cookies' => array(), 'filename' => null );
	}
	return new WP_Error( 'teste_sem_rede', 'Rede externa bloqueada no teste.' );
};
add_filter( 'pre_http_request', $interceptor, 10, 3 );
try {
	delete_transient( $local_key );
	$result = Cronograma_EAD_Service::feriados_local( $unit, $year );
	if ( is_wp_error( $result ) || $requests !== 2 ) {
		WP_CLI::error( 'Teste não interceptou as duas consultas regionais corretamente.' );
	}
	if ( count( $result['avisos'] ) !== 2 || ! empty( $result['feriados'] ) ) {
		WP_CLI::error( 'HTTP 200 com JSON inválido deve gerar dois avisos e nenhum feriado regional.' );
	}
	$timeout = (int) get_option( '_transient_timeout_' . $local_key, 0 );
	if ( $timeout < time() || $timeout > time() + 15 * 60 + 15 ) {
		WP_CLI::error( 'Calendário degradado deve ter cache de até quinze minutos.' );
	}
	$again = Cronograma_EAD_Service::feriados_local( $unit, $year );
	if ( $requests !== 2 || $again !== $result ) {
		WP_CLI::error( 'Segunda consulta deve aproveitar cache degradado até expirar.' );
	}
	// Indisponibilidade real simulada: o transporte retorna WP_Error.
	delete_transient( $local_key );
	$unavailable_calls = 0;
	$unavailable = static function ( $pre, $args, $url ) use ( &$unavailable_calls ) {
		++$unavailable_calls;
		return new WP_Error( 'http_request_failed', 'Timeout sintético da integração.' );
	};
	remove_filter( 'pre_http_request', $interceptor, 10 );
	add_filter( 'pre_http_request', $unavailable, 10, 3 );
	try {
		$result_offline = Cronograma_EAD_Service::feriados_local( $unit, $year );
		if ( is_wp_error( $result_offline ) || 2 !== count( $result_offline['avisos'] ) || ! empty( $result_offline['feriados'] ) || 2 !== $unavailable_calls ) {
			WP_CLI::error( 'Falhas HTTP simultâneas devem gerar dois avisos e resultado vazio.' );
		}
		$timeout_offline = (int) get_option( '_transient_timeout_' . $local_key, 0 );
		if ( $timeout_offline < time() || $timeout_offline > time() + 15 * 60 + 15 ) {
			WP_CLI::error( 'Falha de transporte deve manter TTL curto.' );
		}
	} finally {
		remove_filter( 'pre_http_request', $unavailable, 10 );
		add_filter( 'pre_http_request', $interceptor, 10, 3 );
	}
	WP_CLI::success( 'Feriados: JSON inválido, falha HTTP, avisos, TTL curto e cache reutilizado.' );
} finally {
	remove_filter( 'pre_http_request', $interceptor, 10 );
	remove_filter( 'pre_option_' . Cronograma_EAD_Store::OPT_DATA, $filter_catalog );
	remove_filter( 'pre_option_cronograma_ead_feriados_api_key', $filter_key );
	delete_transient( $national_key );
	delete_transient( $local_key );
}
