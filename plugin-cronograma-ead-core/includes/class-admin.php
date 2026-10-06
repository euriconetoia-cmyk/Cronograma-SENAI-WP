<?php
/**
 * Tela do plugin no painel: páginas, configurações, cópia dos dados e como dar acesso às unidades.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Cronograma_EAD_Admin {

	public static function menu() {
		add_menu_page( 'Cronogramas EaD', 'Cronogramas EaD', Cronograma_EAD_Roles::CAP_CONFIG, 'cronograma-ead', array( __CLASS__, 'screen' ), 'dashicons-calendar-alt', 26 );
	}

	public static function screen() {
		if ( ! current_user_can( Cronograma_EAD_Roles::CAP_CONFIG ) ) {
			return;
		}
		$ids  = Cronograma_EAD_Pages::ids();
		$defs = Cronograma_EAD_Pages::definitions();
		$cat  = Cronograma_EAD_Store::get();
		$d    = $cat['data'];
		$msg  = isset( $_GET['ce_msg'] ) ? sanitize_key( wp_unslash( $_GET['ce_msg'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification
		$msgs = array(
			'pages'    => 'Páginas conferidas. As que faltavam foram criadas.',
			'seed'     => 'Dados de exemplo restaurados.',
			'settings' => 'Configurações salvas.',
		);
		?>
		<div class="wrap">
			<h1>Cronogramas EaD · Unidigit@l</h1>
			<?php if ( isset( $msgs[ $msg ] ) ) : ?>
				<div class="notice notice-success is-dismissible"><p><?php echo esc_html( $msgs[ $msg ] ); ?></p></div>
			<?php endif; ?>

			<p>A Unidigit@l monta o cronograma, envia para a unidade validar, e depois do aceite ele fica travado até a Unidigit@l reabrir.</p>

			<h2>Como dar acesso a uma unidade</h2>
			<ol>
				<li>Cadastre a unidade na página <strong>Unidades</strong> do sistema.</li>
				<li>Crie o usuário em <strong>Usuários &gt; Adicionar novo</strong> com o papel <strong>Unidade escolar (cronogramas)</strong>.</li>
				<li>Abra o perfil do usuário, marque a(s) unidade(s) dele e, para o coordenador, marque <strong>Pode validar</strong>.</li>
			</ol>
			<p>Papéis: <strong>Equipe Unidigit@l (cronogramas)</strong> conduz todo o fluxo; <strong>Unidade escolar (cronogramas)</strong> ajusta e valida só as turmas da sua unidade; <strong>Consulta de cronogramas</strong> só lê as turmas das unidades marcadas. Administradores do site têm acesso administrativo. Editores do WordPress não recebem acesso automático ao sistema.</p>

			<h2>Páginas do sistema</h2>
			<table class="widefat striped" style="max-width:720px">
				<thead><tr><th>Página</th><th>Shortcode</th><th>Ações</th></tr></thead>
				<tbody>
				<?php foreach ( $defs as $view => $def ) : ?>
					<?php $id = isset( $ids[ $view ] ) ? (int) $ids[ $view ] : 0; ?>
					<tr>
						<td><?php echo esc_html( $def[0] ); ?></td>
						<td><code>[cronograma_ead view="<?php echo esc_attr( $view ); ?>"]</code></td>
						<td>
							<?php if ( $id && 'publish' === get_post_status( $id ) ) : ?>
								<a href="<?php echo esc_url( get_permalink( $id ) ); ?>">Abrir</a> ·
								<a href="<?php echo esc_url( get_edit_post_link( $id ) ); ?>">Editar página</a>
							<?php else : ?>
								<em>Página ausente</em>
							<?php endif; ?>
						</td>
					</tr>
				<?php endforeach; ?>
				</tbody>
			</table>
			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" style="margin-top:12px">
				<input type="hidden" name="action" value="cronograma_ead_pages">
				<?php wp_nonce_field( 'cronograma_ead_pages' ); ?>
				<button class="button">Recriar páginas ausentes</button>
			</form>

			<h2>Avisos e prazos</h2>
			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
				<input type="hidden" name="action" value="cronograma_ead_settings">
				<?php wp_nonce_field( 'cronograma_ead_settings' ); ?>
				<table class="form-table" role="presentation">
					<tr>
						<th><label for="ce_prazo">Prazo de validação (dias úteis)</label></th>
						<td><input id="ce_prazo" name="prazo_dias" type="number" min="1" max="60" value="<?php echo (int) get_option( 'cronograma_ead_prazo_dias', 5 ); ?>" class="small-text">
						<p class="description">Contado a partir do envio à unidade. A unidade recebe lembrete um dia antes e, se vencer, a Unidigit@l e a unidade são avisadas. O cronograma não é validado sozinho: a decisão fica com a Unidigit@l.</p></td>
					</tr>
					<tr>
						<th><label for="ce_emails">E-mails da Unidigit@l</label></th>
						<td><input id="ce_emails" name="email_equipe" type="text" class="regular-text" value="<?php echo esc_attr( get_option( 'cronograma_ead_email_equipe', get_option( 'admin_email' ) ) ); ?>">
						<p class="description">Recebem as solicitações e os avisos de validação. Separe por vírgula. Quem tem o papel Equipe também recebe.</p></td>
					</tr>
				</table>
				<button class="button button-primary">Salvar configurações</button>
			</form>

			<h2>Dados</h2>
			<p>
				Cursos: <strong><?php echo count( $d['cursos'] ); ?></strong> ·
				Unidades: <strong><?php echo count( $d['unidades'] ); ?></strong> ·
				Turmas: <strong><?php echo (int) Cronograma_EAD_DB::contar(); ?></strong> ·
				Pessoas: <strong><?php echo count( $d['pessoas'] ); ?></strong> ·
				Feriados: <strong><?php echo count( $d['feriados'] ); ?></strong>
			</p>
			<p><a class="button" href="<?php echo esc_url( wp_nonce_url( admin_url( 'admin-post.php?action=cronograma_ead_export' ), 'cronograma_ead_export' ) ); ?>">Baixar cópia dos dados (.json)</a></p>
			<?php if ( current_user_can( Cronograma_EAD_Roles::CAP_CONFIG ) ) : ?>
				<?php $saude = Cronograma_EAD_Service::saude(); ?>
				<h2>Saúde do sistema</h2>
				<table class="widefat striped" style="max-width:720px">
					<tbody>
						<tr><th>Plugin</th><td><?php echo esc_html( $saude['pluginVersion'] ); ?></td></tr>
						<tr><th>Schema do banco</th><td><?php echo esc_html( $saude['dbVersion'] ); ?></td></tr>
						<tr><th>Tabelas</th><td><?php echo esc_html( implode( ', ', array_map( function ( $k, $ok ) { return $k . ': ' . ( $ok ? 'OK' : 'FALTA' ); }, array_keys( $saude['tables'] ), array_values( $saude['tables'] ) ) ) ); ?></td></tr>
						<tr><th>Último cron</th><td><?php echo esc_html( $saude['cron']['lastRun'] ?: 'Ainda não executado' ); ?></td></tr>
						<tr><th>Próximo cron</th><td><?php echo esc_html( $saude['cron']['nextRun'] ?: 'Não agendado' ); ?></td></tr>
						<tr><th>Turmas</th><td><?php echo (int) $saude['turmas']; ?></td></tr>
						<tr><th>Backup pré-importação</th><td><?php echo esc_html( $saude['lastPreImportBackup'] ?: 'Ainda não gerado' ); ?></td></tr>
					</tbody>
				</table>
			<?php endif; ?>

			<?php if ( current_user_can( 'manage_options' ) ) : ?>
				<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" onsubmit="return confirm('Isto troca cursos, equipe, feriados e unidades pelos dados de exemplo e recoloca a turma de exemplo. Turmas que você criou continuam. Continuar?');">
					<input type="hidden" name="action" value="cronograma_ead_seed">
					<?php wp_nonce_field( 'cronograma_ead_seed' ); ?>
					<button class="button">Restaurar dados de exemplo (TST Itumbiara)</button>
				</form>
			<?php endif; ?>
		</div>
		<?php
	}

	public static function handle_pages() {
		if ( ! current_user_can( Cronograma_EAD_Roles::CAP_CONFIG ) ) {
			wp_die( 'Sem permissão.', 403 );
		}
		check_admin_referer( 'cronograma_ead_pages' );
		Cronograma_EAD_Pages::ensure_all();
		wp_safe_redirect( admin_url( 'admin.php?page=cronograma-ead&ce_msg=pages' ) );
		exit;
	}

	public static function handle_settings() {
		if ( ! current_user_can( Cronograma_EAD_Roles::CAP_CONFIG ) ) {
			wp_die( 'Sem permissão.', 403 );
		}
		check_admin_referer( 'cronograma_ead_settings' );
		$dias = isset( $_POST['prazo_dias'] ) ? (int) $_POST['prazo_dias'] : 5;
		update_option( 'cronograma_ead_prazo_dias', max( 1, min( 60, $dias ) ), false );
		$em = isset( $_POST['email_equipe'] ) ? sanitize_text_field( wp_unslash( $_POST['email_equipe'] ) ) : '';
		update_option( 'cronograma_ead_email_equipe', $em, false );
		wp_safe_redirect( admin_url( 'admin.php?page=cronograma-ead&ce_msg=settings' ) );
		exit;
	}

	public static function handle_seed() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Sem permissão.', 403 );
		}
		check_admin_referer( 'cronograma_ead_seed' );
		Cronograma_EAD_Store::seed();
		wp_safe_redirect( admin_url( 'admin.php?page=cronograma-ead&ce_msg=seed' ) );
		exit;
	}

	public static function handle_export() {
		if ( ! current_user_can( Cronograma_EAD_Roles::CAP_EXPORT ) ) {
			wp_die( 'Sem permissão.', 403 );
		}
		check_admin_referer( 'cronograma_ead_export' );
		nocache_headers();
		header( 'Content-Type: application/json; charset=utf-8' );
		header( 'Content-Disposition: attachment; filename="cronogramas-ead-' . gmdate( 'Y-m-d' ) . '.json"' );
		echo wp_json_encode( Cronograma_EAD_Service::exportar(), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE ); // phpcs:ignore WordPress.Security.EscapeOutput
		exit;
	}
}
