<?php
/**
 * Controles de segurança transversais: rate limiting e identificação de requisições.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Cronograma_EAD_Security {
	const RATE_PREFIX = 'ce_rate_';

	/** ID curto para correlacionar operações e logs sem expor segredos. */
	public static function request_id() {
		static $id = null;
		if ( null === $id ) {
			$id = function_exists( 'wp_generate_uuid4' ) ? wp_generate_uuid4() : uniqid( 'ce_', true );
		}
		return $id;
	}

	/**
	 * Limita uma ação por usuário/chave dentro de uma janela.
	 *
	 * @return true|WP_Error
	 */
	public static function rate_limit( $action, $subject = '', $limit = 5, $window = HOUR_IN_SECONDS ) {
		$uid = (int) get_current_user_id();
		$key = self::RATE_PREFIX . md5( sanitize_key( (string) $action ) . '|' . $uid . '|' . (string) $subject );
		$now = time();
		$cur = get_transient( $key );
		if ( ! is_array( $cur ) || empty( $cur['expires'] ) || (int) $cur['expires'] <= $now ) {
			$cur = array( 'count' => 0, 'expires' => $now + max( 60, (int) $window ) );
		}
		if ( (int) $cur['count'] >= max( 1, (int) $limit ) ) {
			return new WP_Error(
				'cronograma_ead_rate_limit',
				'Muitas tentativas em pouco tempo. Aguarde e tente novamente.',
				array( 'status' => 429, 'retry_after' => max( 1, (int) $cur['expires'] - $now ) )
			);
		}
		$cur['count'] = (int) $cur['count'] + 1;
		set_transient( $key, $cur, max( 60, (int) $cur['expires'] - $now ) );
		return true;
	}
}
