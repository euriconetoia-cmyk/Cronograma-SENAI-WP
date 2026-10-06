<?php
/**
 * Permissões do sistema, separadas por operação para aplicar menor privilégio.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Cronograma_EAD_Roles {
	const CAP_VIEW             = 'cronograma_ead_ver';
	const CAP_EDIT_TURMAS      = 'cronograma_ead_editar_turmas';
	const CAP_VALIDATE         = 'cronograma_ead_validar';
	const CAP_VALIDATE_AS_UNIT = 'cronograma_ead_validar_em_nome';
	const CAP_CATALOG          = 'cronograma_ead_gerir_catalogo';
	const CAP_ACCOUNTS         = 'cronograma_ead_gerir_acessos';
	const CAP_EXPORT           = 'cronograma_ead_exportar';
	const CAP_IMPORT           = 'cronograma_ead_importar';
	const CAP_CONFIG           = 'cronograma_ead_configurar';
	const CAP_AUDIT            = 'cronograma_ead_auditar';

	// Legadas. Permanecem apenas para migração e compatibilidade de código antigo.
	const CAP_EDIT = 'cronograma_ead_editar';
	const CAP_UNIT = 'cronograma_ead_unidade';

	public static function operational_caps() {
		return array(
			self::CAP_VIEW,
			self::CAP_EDIT_TURMAS,
			self::CAP_VALIDATE_AS_UNIT,
			self::CAP_CATALOG,
			self::CAP_ACCOUNTS,
			self::CAP_EXPORT,
			self::CAP_IMPORT,
			self::CAP_AUDIT,
		);
	}

	public static function admin_caps() {
		return array_values( array_unique( array_merge( self::operational_caps(), array( self::CAP_VALIDATE, self::CAP_CONFIG ) ) ) );
	}

	private static function set_caps( $role, array $caps ) {
		if ( ! $role ) {
			return;
		}
		foreach ( self::all_caps() as $cap ) {
			$role->remove_cap( $cap );
		}
		foreach ( $caps as $cap ) {
			$role->add_cap( $cap );
		}
	}

	public static function all_caps() {
		return array_values(
			array_unique(
				array_merge(
					self::admin_caps(),
					array( self::CAP_EDIT, self::CAP_UNIT )
				)
			)
		);
	}

	public static function install() {
		// Administrador do site mantém controle completo. Editor nativo não recebe acesso ao sistema.
		self::set_caps( get_role( 'administrator' ), self::admin_caps() );
		self::set_caps( get_role( 'editor' ), array() );

		if ( ! get_role( 'cronograma_ead_equipe' ) ) {
			add_role( 'cronograma_ead_equipe', 'Equipe Unidigit@l (cronogramas)', array( 'read' => true ) );
		}
		self::set_caps( get_role( 'cronograma_ead_equipe' ), self::operational_caps() );

		if ( ! get_role( 'cronograma_ead_unidade' ) ) {
			add_role( 'cronograma_ead_unidade', 'Unidade escolar (cronogramas)', array( 'read' => true ) );
		}
		self::set_caps( get_role( 'cronograma_ead_unidade' ), array( self::CAP_VIEW, self::CAP_EDIT_TURMAS ) );

		if ( ! get_role( 'cronograma_ead_consulta' ) ) {
			add_role( 'cronograma_ead_consulta', 'Consulta de cronogramas', array( 'read' => true ) );
		}
		self::set_caps( get_role( 'cronograma_ead_consulta' ), array( self::CAP_VIEW ) );
	}

	public static function remove() {
		remove_role( 'cronograma_ead_equipe' );
		remove_role( 'cronograma_ead_consulta' );
		remove_role( 'cronograma_ead_unidade' );
		foreach ( array( 'administrator', 'editor' ) as $slug ) {
			$role = get_role( $slug );
			if ( $role ) {
				foreach ( self::all_caps() as $cap ) {
					$role->remove_cap( $cap );
				}
			}
		}
	}
}
