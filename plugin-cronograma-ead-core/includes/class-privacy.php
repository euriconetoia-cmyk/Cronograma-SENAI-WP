<?php
/** Integrações de privacidade e documentação do tratamento de dados. */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Cronograma_EAD_Privacy {
	public static function hooks() {
		add_filter( 'wp_privacy_personal_data_exporters', array( __CLASS__, 'exporters' ) );
		add_filter( 'wp_privacy_personal_data_erasers', array( __CLASS__, 'erasers' ) );
		add_action( 'admin_init', array( __CLASS__, 'policy_content' ) );
	}

	public static function exporters( $exporters ) {
		$exporters['cronograma-ead'] = array(
			'exporter_friendly_name' => 'Cronogramas EaD',
			'callback' => array( __CLASS__, 'export_user_data' ),
		);
		return $exporters;
	}

	public static function erasers( $erasers ) {
		$erasers['cronograma-ead'] = array(
			'eraser_friendly_name' => 'Cronogramas EaD',
			'callback' => array( __CLASS__, 'erase_user_data' ),
		);
		return $erasers;
	}

	private static function find_user( $email ) {
		$email = sanitize_email( (string) $email );
		return $email ? get_user_by( 'email', $email ) : false;
	}

	public static function export_user_data( $email, $page = 1 ) {
		$user = self::find_user( $email );
		if ( ! $user ) {
			return array( 'data' => array(), 'done' => true );
		}
		$units = get_user_meta( $user->ID, Cronograma_EAD_Users::META_UNIDADES, true );
		$data = array(
			array( 'name' => 'Unidades vinculadas', 'value' => implode( ', ', is_array( $units ) ? $units : array() ) ),
			array( 'name' => 'Pode validar cronogramas', 'value' => get_user_meta( $user->ID, Cronograma_EAD_Users::META_VALIDADOR, true ) ? 'Sim' : 'Não' ),
			array( 'name' => 'Acesso desativado', 'value' => get_user_meta( $user->ID, Cronograma_EAD_Accounts::META_INATIVO, true ) ? 'Sim' : 'Não' ),
			array( 'name' => 'Último acesso registrado', 'value' => (string) get_user_meta( $user->ID, Cronograma_EAD_Accounts::META_ULTIMO, true ) ),
		);
		return array(
			'data' => array(
				array(
					'group_id' => 'cronograma-ead',
					'group_label' => 'Cronogramas EaD',
					'item_id' => 'cronograma-user-' . (int) $user->ID,
					'data' => $data,
				),
			),
			'done' => true,
		);
	}

	/**
	 * Remove apenas metadados operacionais que não são necessários para a trilha histórica.
	 * Logs e snapshots são preservados conforme a política institucional de auditoria.
	 */
	public static function erase_user_data( $email, $page = 1 ) {
		$user = self::find_user( $email );
		if ( ! $user ) {
			return array( 'items_removed' => false, 'items_retained' => false, 'messages' => array(), 'done' => true );
		}
		delete_user_meta( $user->ID, Cronograma_EAD_Users::META_UNIDADES );
		delete_user_meta( $user->ID, Cronograma_EAD_Users::META_VALIDADOR );
		delete_user_meta( $user->ID, Cronograma_EAD_Accounts::META_ULTIMO );
		return array(
			'items_removed' => true,
			'items_retained' => true,
			'messages' => array( 'Histórico de auditoria e versões validadas foram preservados por necessidade de rastreabilidade institucional. Consulte a política de retenção antes de exclusão definitiva.' ),
			'done' => true,
		);
	}

	public static function policy_content() {
		if ( ! function_exists( 'wp_add_privacy_policy_content' ) ) {
			return;
		}
		wp_add_privacy_policy_content(
			'Cronogramas EaD',
			'<p>O Cronogramas EaD registra vínculos de usuários com unidades, permissões operacionais, último acesso e trilhas de auditoria necessárias à gestão dos cronogramas. Tokens de senha e senhas não são armazenados nos logs da aplicação.</p><p>Os períodos de retenção de históricos, versões e auditoria devem seguir a política institucional documentada para o ambiente.</p>'
		);
	}
}
