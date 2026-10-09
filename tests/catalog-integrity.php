<?php
/**
 * Caracterização isolada da integridade do catálogo (sem WordPress nem banco reais).
 *
 * Executar: php tests/catalog-integrity.php
 * Não testa concorrência real ou transações SQL.
 */
define( 'ABSPATH', __DIR__ );
class WP_Error {
	public function __construct( public $code, public $message, public $data = array() ) {}
}
function is_wp_error( $value ) { return $value instanceof WP_Error; }
function wp_json_encode( $value ) { return json_encode( $value ); }
function sanitize_text_field( $value ) { return trim( strip_tags( (string) $value ) ); }
$test_options = array();
$test_transients = array();
function get_option( $name, $fallback = false ) { global $test_options; return $test_options[ $name ] ?? $fallback; }
function update_option( $name, $value, $autoload = null ) { global $test_options; $test_options[ $name ] = $value; return true; }
function get_transient( $name ) { global $test_transients; return $test_transients[ $name ] ?? false; }
function set_transient( $name, $value, $expiration ) { global $test_transients; $test_transients[ $name ] = $value; return true; }
function delete_transient( $name ) { global $test_transients; unset( $test_transients[ $name ] ); return true; }
require_once __DIR__ . '/../plugin-cronograma-ead-core/includes/class-rules.php';
require_once __DIR__ . '/../plugin-cronograma-ead-core/includes/class-store.php';
function ensure( $condition, $message ) {
	if ( ! $condition ) { fwrite( STDERR, "FAIL: $message\n" ); exit( 1 ); }
}
$catalog = array( 'cursos' => array(), 'pessoas' => array(), 'feriados' => array(), 'unidades' => array() );
$first = Cronograma_EAD_Store::save( $catalog, 0 );
ensure( ! is_wp_error( $first ) && 1 === $first['rev'], 'A primeira atualização deve gerar revisão 1.' );
$stale = Cronograma_EAD_Store::save( $catalog, 0 );
ensure( is_wp_error( $stale ) && 'cronograma_ead_conflito' === $stale->code, 'Revisão obsoleta deve ser rejeitada.' );
$second = Cronograma_EAD_Store::save( $catalog, 1 );
ensure( ! is_wp_error( $second ) && 2 === $second['rev'], 'A revisão atual deve permitir atualização.' );
$read = Cronograma_EAD_Store::get();
ensure( 2 === $read['rev'] && $read['data'] === $catalog, 'Catálogo e revisão devem concordar no fluxo sequencial.' );
echo "OK catalog-integrity: gravação sequencial, conflito de revisão e leitura\n";
echo "NOT TESTED: concorrência simultânea, falha parcial de options e rollback SQL\n";
