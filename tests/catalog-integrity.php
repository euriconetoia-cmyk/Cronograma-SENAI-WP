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
function update_option( $name, $value, $autoload = null ) { global $test_options, $fail_option, $fail_compensation; if ( $fail_option === $name || ( ! empty( $fail_compensation ) && $name === 'cronograma_ead_data' && $value === wp_json_encode( array( 'cursos'=>array(), 'pessoas'=>array(), 'feriados'=>array(), 'unidades'=>array() ) ) ) ) return false; $test_options[ $name ] = $value; return true; }
function add_option( $name, $value, $deprecated = '', $autoload = false ) { global $test_options; if ( array_key_exists( $name, $test_options ) ) { return false; } $test_options[ $name ] = $value; return true; }
function delete_option( $name ) { global $test_options; unset( $test_options[ $name ] ); return true; }
function wp_cache_delete( $key, $group = '' ) { return true; }
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
$lock_name = 'cronograma_ead_catalog_write_lock';
ensure( add_option( $lock_name, time(), '', false ), 'Fixture deve conseguir adquirir mutex.' );
$blocked = Cronograma_EAD_Store::save( $catalog, 1 );
ensure( is_wp_error( $blocked ) && 'cronograma_ead_ocupado' === $blocked->code, 'Gravação concorrente deve ser bloqueada por mutex atômico.' );
delete_option( $lock_name );
$second = Cronograma_EAD_Store::save( $catalog, 1 );
ensure( ! is_wp_error( $second ) && 2 === $second['rev'], 'A revisão atual deve permitir atualização.' );
$fail_option = Cronograma_EAD_Store::OPT_REV;
$failed = Cronograma_EAD_Store::save( array_merge( $catalog, array( 'feriados' => array( array( '2026-10-09', 'Teste' ) ) ) ), 2 );
ensure( is_wp_error( $failed ) && 'cronograma_ead_gravacao' === $failed->code, 'Falha parcial na revisão deve retornar erro.' );
$fail_option = null;
ensure( Cronograma_EAD_Store::get()['data'] === $catalog && Cronograma_EAD_Store::get()['rev'] === 2, 'Falha parcial deve recuperar dados anteriores.' );
// Se a escrita de revisão e a compensação falharem, não declarar recuperação.
$fail_option = Cronograma_EAD_Store::OPT_REV;
$fail_compensation = true;
$failed_compensation = Cronograma_EAD_Store::save( array_merge( $catalog, array( 'feriados' => array( array( '2026-10-10', 'Erro injetado' ) ) ) ), 2 );
ensure( is_wp_error( $failed_compensation ) && 'cronograma_ead_inconsistencia' === $failed_compensation->code, 'Compensação falha deve ser sinalizada como inconsistência crítica.' );
$fail_option = null;
$fail_compensation = false;
update_option( Cronograma_EAD_Store::OPT_DATA, wp_json_encode( $catalog ), false );
$read = Cronograma_EAD_Store::get();
ensure( 2 === $read['rev'] && $read['data'] === $catalog, 'Catálogo e revisão devem concordar no fluxo sequencial.' );
echo "OK catalog-integrity: gravação sequencial, conflito de revisão e leitura\n";
echo "NOT TESTED: concorrência simultânea, falha parcial de options e rollback SQL\n";
