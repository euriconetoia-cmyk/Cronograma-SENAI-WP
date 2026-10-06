<?php
define( 'CRONOGRAMA_EAD_TESTING', true );
if ( ! defined( 'DAY_IN_SECONDS' ) ) { define( 'DAY_IN_SECONDS', 86400 ); }
require_once __DIR__ . '/../plugin-cronograma-ead-core/includes/class-rules.php';

function fail_test( $m ) { fwrite( STDERR, "FAIL: $m\n" ); exit( 1 ); }
function ok( $cond, $m ) { if ( ! $cond ) fail_test( $m ); }

$valid = array( '2024-02-29', '2026-01-01', '2030-12-31' );
$invalid = array( '2026-02-30', '2026-02-31', '2026-13-10', '2026-00-10', '2026-04-31', '26-01-01', '' );
foreach ( $valid as $d ) ok( Cronograma_EAD_Rules::data_ok( $d ), "valid date rejected: $d" );
foreach ( $invalid as $d ) ok( ! Cronograma_EAD_Rules::data_ok( $d ), "invalid date accepted: $d" );

$fx = json_decode( file_get_contents( __DIR__ . '/calendar-fixtures.json' ), true );
foreach ( $fx as $c ) {
    $got = Cronograma_EAD_Rules::somar_uteis( $c['start'], $c['days'], $c['holidays'] );
    ok( $got === $c['expected'], $c['id'] . " expected {$c['expected']} got $got" );
}

echo 'OK unit-rules: ' . count( $fx ) . " calendar fixtures + date validation\n";
