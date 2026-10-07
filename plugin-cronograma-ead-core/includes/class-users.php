<?php
/**
 * Vínculo dos usuários com as unidades escolares e indicação de quem valida.
 * Aparece no perfil do usuário (só para quem pode editar usuários).
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Cronograma_EAD_Users {

	const META_UNIDADES = 'ce_unidades';
	const META_VALIDADOR = 'ce_validador';

	public static function hooks() {
		add_action( 'show_user_profile', array( __CLASS__, 'campos' ) );
		add_action( 'edit_user_profile', array( __CLASS__, 'campos' ) );
		add_action( 'personal_options_update', array( __CLASS__, 'salvar' ) );
		add_action( 'edit_user_profile_update', array( __CLASS__, 'salvar' ) );
		add_filter( 'manage_users_columns', array( __CLASS__, 'coluna' ) );
		add_filter( 'manage_users_custom_column', array( __CLASS__, 'coluna_valor' ), 10, 3 );
	}

	public static function campos( $user ) {
		if ( ! current_user_can( 'edit_users' ) ) {
			return;
		}
		$cat  = Cronograma_EAD_Store::get();
		$mine = Cronograma_EAD_Service::unidades_do_usuario( $user->ID );
		wp_nonce_field( 'cronograma_ead_user_' . $user->ID, 'cronograma_ead_user_nonce' );
		?>
		<h2>Cronogramas EaD (Unidigit@l)</h2>
		<table class="form-table" role="presentation">
			<tr>
				<th>Unidades escolares</th>
				<td>
					<?php if ( ! $cat['data']['unidades'] ) : ?>
						<em>Nenhuma unidade cadastrada ainda. Cadastre em Cronogramas EaD &gt; Unidades.</em>
					<?php endif; ?>
					<?php foreach ( $cat['data']['unidades'] as $u ) : ?>
						<label style="display:block">
							<input type="checkbox" name="ce_unidades[]" value="<?php echo esc_attr( $u['id'] ); ?>" <?php checked( in_array( $u['id'], $mine, true ) ); ?>>
							<?php echo esc_html( isset( $u['nome'] ) ? $u['nome'] : $u['id'] ); ?>
						</label>
					<?php endforeach; ?>
					<p class="description">A pessoa só vê as turmas das unidades marcadas (vale para os papéis Unidade e Consulta).</p>
				</td>
			</tr>
			<tr>
				<th>Pode validar</th>
				<td>
					<label><input type="checkbox" name="ce_validador" value="1" <?php checked( self::validador( $user->ID ) ); ?>> Pode validar cronogramas da unidade</label>
					<p class="description">Indique o coordenador da unidade. Quem não tem esta marca ajusta, mas não valida.</p>
				</td>
			</tr>
		</table>
		<?php
	}

	private static function validador( $uid ) {
		return (bool) get_user_meta( $uid, self::META_VALIDADOR, true );
	}

	public static function salvar( $user_id ) {
		if ( ! current_user_can( 'edit_users' ) || ! isset( $_POST['cronograma_ead_user_nonce'] ) ) {
			return;
		}
		if ( ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['cronograma_ead_user_nonce'] ) ), 'cronograma_ead_user_' . $user_id ) ) {
			return;
		}
		$validas = array();
		$cat     = Cronograma_EAD_Store::get();
		foreach ( $cat['data']['unidades'] as $u ) {
			$validas[] = $u['id'];
		}
		$sel = isset( $_POST['ce_unidades'] ) && is_array( $_POST['ce_unidades'] ) ? array_map( 'sanitize_text_field', wp_unslash( $_POST['ce_unidades'] ) ) : array();
		update_user_meta( $user_id, self::META_UNIDADES, array_values( array_intersect( $sel, $validas ) ) );
		update_user_meta( $user_id, self::META_VALIDADOR, ! empty( $_POST['ce_validador'] ) ? 1 : 0 );
	}

	public static function coluna( $cols ) {
		$cols['ce_unidades'] = 'Unidades (cronogramas)';
		return $cols;
	}

	public static function coluna_valor( $val, $col, $user_id ) {
		if ( 'ce_unidades' !== $col ) {
			return $val;
		}
		$ids = Cronograma_EAD_Service::unidades_do_usuario( $user_id );
		if ( ! $ids ) {
			return '—';
		}
		$cat   = Cronograma_EAD_Store::get();
		$nomes = array();
		foreach ( $cat['data']['unidades'] as $u ) {
			if ( in_array( $u['id'], $ids, true ) ) {
				$nomes[] = $u['nome'];
			}
		}
		return esc_html( implode( ', ', $nomes ) ) . ( self::validador( $user_id ) ? ' (valida)' : '' );
	}
}
