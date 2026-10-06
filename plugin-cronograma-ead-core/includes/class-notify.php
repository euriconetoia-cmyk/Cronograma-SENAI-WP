<?php
/**
 * Avisos por e-mail do fluxo de validação e lembretes de prazo.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Cronograma_EAD_Notify {

	/** Resultado do último envio: true/false, ou null se não havia destinatário. */
	public static $ultimo = null;

	private static function link( $row ) {
		$urls = Cronograma_EAD_Pages::urls();
		$base = isset( $urls['cronograma'] ) ? $urls['cronograma'] : home_url( '/' );
		return add_query_arg( 'turma', rawurlencode( $row->id ), $base );
	}

	private static function nome_turma( $row ) {
		$t = json_decode( $row->data, true );
		return ( is_array( $t ) && ! empty( $t['nome'] ) ) ? $t['nome'] : $row->id;
	}

	private static function curso_pedido( $row ) {
		$t = json_decode( $row->data, true );
		return ( is_array( $t ) && empty( $t['cursoId'] ) && ! empty( $t['cursoSolicitado'] ) ) ? (string) $t['cursoSolicitado'] : '';
	}

	private static function nome_unidade( $id ) {
		$cat = Cronograma_EAD_Store::get();
		foreach ( $cat['data']['unidades'] as $u ) {
			if ( $u['id'] === $id ) {
				return isset( $u['nome'] ) ? $u['nome'] : $id;
			}
		}
		return $id;
	}

	/** E-mails das pessoas da unidade (todas as vinculadas, validadoras primeiro). */
	public static function emails_unidade( $unidade_id ) {
		$users = get_users(
			array(
				'meta_key'     => Cronograma_EAD_Users::META_UNIDADES, // phpcs:ignore WordPress.DB.SlowDBQuery
				'meta_value'   => '"' . $unidade_id . '"', // phpcs:ignore WordPress.DB.SlowDBQuery
				'meta_compare' => 'LIKE',
				'fields'       => array( 'ID', 'user_email' ),
			)
		);
		$emails = array();
		foreach ( $users as $u ) {
			if ( ! Cronograma_EAD_Accounts::inativo( $u->ID ) && is_email( $u->user_email ) ) {
				$emails[] = $u->user_email;
			}
		}
		return array_values( array_unique( $emails ) );
	}

	public static function emails_equipe() {
		$emails = array();
		foreach ( get_users( array( 'role' => 'cronograma_ead_equipe', 'fields' => array( 'ID', 'user_email' ) ) ) as $u ) {
			if ( ! Cronograma_EAD_Accounts::inativo( $u->ID ) && is_email( $u->user_email ) ) {
				$emails[] = $u->user_email;
			}
		}
		$extra = (string) get_option( 'cronograma_ead_email_equipe', get_option( 'admin_email' ) );
		foreach ( preg_split( '/[,;\s]+/', $extra ) as $e ) {
			if ( is_email( $e ) ) {
				$emails[] = $e;
			}
		}
		return array_values( array_unique( $emails ) );
	}

	private static function enviar( $para, $assunto, $linhas, $row ) {
		if ( ! $para ) {
			self::$ultimo = null;
			return;
		}
		$corpo = implode( "\n\n", $linhas ) . "\n\nAbrir o cronograma: " . self::link( $row ) . "\n\n— Unidigit@l · Cronogramas EaD";
		self::$ultimo = (bool) wp_mail( $para, '[Cronogramas EaD] ' . $assunto, $corpo );
	}

	public static function solicitacao( $row ) {
		self::enviar(
			self::emails_equipe(),
			'Nova solicitação de turma',
			array_merge(
				array( 'A unidade ' . self::nome_unidade( $row->unidade_id ) . ' solicitou a turma "' . self::nome_turma( $row ) . '".' ),
				self::curso_pedido( $row ) ? array( 'O curso pedido ainda não está cadastrado: "' . self::curso_pedido( $row ) . '". Cadastre o curso em Cursos para poder iniciar a turma.' ) : array()
			),
			$row
		);
	}

	public static function transicao( $acao, $row, $motivo, $ressalva ) {
		$turma   = self::nome_turma( $row );
		$unidade = self::nome_unidade( $row->unidade_id );
		switch ( $acao ) {
			case 'enviar':
				$prazo = $row->prazo ? gmdate( 'd/m/Y', strtotime( $row->prazo ) ) : '';
				self::enviar( self::emails_unidade( $row->unidade_id ), 'Cronograma para validar: ' . $turma, array( "O cronograma da turma \"$turma\" ($unidade) está pronto para a sua validação." . ( $prazo ? " Prazo: $prazo." : '' ), 'Você pode ajustar datas dos encontros, ambiente, professor e coordenador. Depois, clique em Validar.' ), $row );
				break;
			case 'recolher':
				self::enviar( self::emails_unidade( $row->unidade_id ), 'Cronograma recolhido: ' . $turma, array( "A Unidigit@l recolheu o cronograma da turma \"$turma\" para ajustes. Motivo: $motivo" ), $row );
				break;
			case 'validar':
				$l = array( "O cronograma da turma \"$turma\" ($unidade) foi validado (versão " . (int) $row->versao . ').' );
				if ( '' !== $ressalva ) {
					$l[] = "Ressalva registrada: $ressalva";
				}
				self::enviar( self::emails_equipe(), 'Cronograma validado: ' . $turma, $l, $row );
				break;
			case 'reabrir':
				self::enviar( self::emails_unidade( $row->unidade_id ), 'Cronograma reaberto: ' . $turma, array( "O cronograma da turma \"$turma\" foi reaberto para validação (versão " . (int) $row->versao . "). Motivo: $motivo" ), $row );
				break;
			case 'iniciar':
				self::enviar( self::emails_unidade( $row->unidade_id ), 'Sua solicitação foi aceita: ' . $turma, array( "A Unidigit@l começou a montar o cronograma da turma \"$turma\". Você receberá um aviso quando ele estiver pronto para validar." ), $row );
				break;
		}
	}

	public static function comentario( $row, $texto, $perfil ) {
		$turma = self::nome_turma( $row );
		$para  = ( 'unidade' === $perfil ) ? self::emails_equipe() : self::emails_unidade( $row->unidade_id );
		self::enviar( $para, 'Mensagem sobre a turma ' . $turma, array( ( 'unidade' === $perfil ? 'A unidade ' . self::nome_unidade( $row->unidade_id ) : 'A Unidigit@l' ) . " escreveu sobre a turma \"$turma\":", $texto ), $row );
	}

	/** Roda uma vez por dia: lembra a unidade um dia antes do prazo e avisa quando vence. */
	public static function diario() {
		update_option( 'cronograma_ead_ultimo_cron', gmdate( 'c' ), false );
		$hoje = current_time( 'Y-m-d' );
		$cat = Cronograma_EAD_Store::get();
		foreach ( Cronograma_EAD_DB::listar( null ) as $row ) {
			if ( Cronograma_EAD_Rules::S_VALIDACAO !== $row->status || ! $row->prazo ) {
				continue;
			}
			$turma  = self::nome_turma( $row );
			$feriados = array_values( array_filter( $cat['data']['feriados'], function ( $f ) use ( $row ) { return ! isset( $f[2] ) || '' === $f[2] || $f[2] === $row->unidade_id; } ) );
			$amanha = Cronograma_EAD_Rules::somar_uteis( $hoje, 1, $feriados );
			if ( $row->prazo === $amanha && ! Cronograma_EAD_DB::tem_log( $row->id, $row->versao, 'lembrete' ) ) {
				self::enviar( self::emails_unidade( $row->unidade_id ), 'Prazo de validação termina em breve: ' . $turma, array( "O prazo para validar o cronograma da turma \"$turma\" termina em " . gmdate( 'd/m/Y', strtotime( $row->prazo ) ) . '.' ), $row );
				Cronograma_EAD_DB::log( $row->id, $row->versao, 'lembrete', 'Lembrete automático enviado à unidade.' );
			} elseif ( $row->prazo < $hoje && ! Cronograma_EAD_DB::tem_log( $row->id, $row->versao, 'atraso' ) ) {
				$l = array( "O prazo de validação do cronograma da turma \"$turma\" (" . self::nome_unidade( $row->unidade_id ) . ') venceu em ' . gmdate( 'd/m/Y', strtotime( $row->prazo ) ) . '.' );
				self::enviar( array_values( array_unique( array_merge( self::emails_equipe(), self::emails_unidade( $row->unidade_id ) ) ) ), 'Prazo de validação vencido: ' . $turma, $l, $row );
				Cronograma_EAD_DB::log( $row->id, $row->versao, 'atraso', 'Prazo de validação vencido; aviso enviado.' );
			}
		}
	}
}
