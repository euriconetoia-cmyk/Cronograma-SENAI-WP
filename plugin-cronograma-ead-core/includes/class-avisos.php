<?php
/**
 * Avisos dentro do sistema (sino) e pedidos das unidades.
 * Cada aviso é endereçado a um lado: "equipe" (Unidigit@l) ou "unidade".
 * Pedidos (pedido = 1) ficam abertos até a Unidigit@l marcar como atendido.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Cronograma_EAD_Avisos {

	const SUBTIPOS = array( 'alteracao', 'reabertura', 'duvida' );

	public static function t() {
		return Cronograma_EAD_DB::t( 'avisos' );
	}

	public static function install() {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		$c = $wpdb->get_charset_collate();
		dbDelta(
			'CREATE TABLE ' . self::t() . " (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  turma_id varchar(64) NOT NULL,
  unidade_id varchar(64) NOT NULL DEFAULT '',
  para varchar(10) NOT NULL DEFAULT 'equipe',
  tipo varchar(20) NOT NULL DEFAULT 'info',
  subtipo varchar(20) NOT NULL DEFAULT '',
  titulo varchar(190) NOT NULL DEFAULT '',
  texto text NULL,
  de_nome varchar(190) NOT NULL DEFAULT '',
  pedido tinyint(1) NOT NULL DEFAULT 0,
  email_ok tinyint(1) DEFAULT NULL,
  criado_em datetime NOT NULL,
  lido_em datetime DEFAULT NULL,
  lido_por varchar(190) NOT NULL DEFAULT '',
  atendido_em datetime DEFAULT NULL,
  atendido_por varchar(190) NOT NULL DEFAULT '',
  PRIMARY KEY  (id),
  KEY turma_id (turma_id),
  KEY para (para, unidade_id)
) $c;"
		);
	}

	/**
	 * Registra um aviso. O estado do e-mail vem do último envio feito por Cronograma_EAD_Notify.
	 */
	public static function criar( $row, $para, $tipo, $titulo, $texto = '', $subtipo = '', $pedido = 0 ) {
		global $wpdb;
		$u        = wp_get_current_user();
		$email_ok = Cronograma_EAD_Notify::$ultimo;
		Cronograma_EAD_Notify::$ultimo = null;
		$wpdb->insert(
			self::t(),
			array(
				'turma_id'   => $row->id,
				'unidade_id' => $row->unidade_id,
				'para'       => 'unidade' === $para ? 'unidade' : 'equipe',
				'tipo'       => $tipo,
				'subtipo'    => $subtipo,
				'titulo'     => mb_substr( $titulo, 0, 190 ),
				'texto'      => $texto,
				'de_nome'    => $u->ID ? $u->display_name : 'Sistema',
				'pedido'     => $pedido ? 1 : 0,
				'email_ok'   => null === $email_ok ? null : ( $email_ok ? 1 : 0 ),
				'criado_em'  => Cronograma_EAD_DB::agora(),
			)
		);
		if ( 0 === $email_ok || false === $email_ok ) {
			Cronograma_EAD_DB::log( $row->id, $row->versao, 'email_falhou', 'O e-mail deste aviso não foi enviado (' . ( 'unidade' === $para ? 'para a unidade' : 'para a Unidigit@l' ) . '). O aviso continua no sino do sistema.' );
		}
	}

	/** Pedidos abertos desta turma passam a atendidos. */
	public static function atender_turma( $turma_id, $quem = '' ) {
		global $wpdb;
		$wpdb->query( $wpdb->prepare( 'UPDATE ' . self::t() . ' SET atendido_em = %s, atendido_por = %s, lido_em = COALESCE(lido_em, %s), lido_por = IF(lido_em IS NULL, %s, lido_por) WHERE turma_id = %s AND pedido = 1 AND atendido_em IS NULL', Cronograma_EAD_DB::agora(), $quem, Cronograma_EAD_DB::agora(), $quem, $turma_id ) ); // phpcs:ignore WordPress.DB.PreparedSQL
	}

	private static function fmt( $a, $lado ) {
		return array(
			'id'          => (int) $a->id,
			'turmaId'     => $a->turma_id,
			'unidadeId'   => $a->unidade_id,
			'para'        => $a->para,
			'tipo'        => $a->tipo,
			'subtipo'     => $a->subtipo,
			'titulo'      => $a->titulo,
			'texto'       => (string) $a->texto,
			'de'          => $a->de_nome,
			'pedido'      => (bool) $a->pedido,
			'emailOk'     => null === $a->email_ok ? null : (bool) $a->email_ok,
			'em'          => $a->criado_em,
			'lido'        => (bool) $a->lido_em,
			'atendidoEm'  => $a->atendido_em,
			'atendidoPor' => $a->atendido_por,
			'meu'         => $a->para === $lado,
		);
	}

	/** Lista do perfil atual + contadores. */
	public static function listar() {
		global $wpdb;
		$perfil = Cronograma_EAD_Service::perfil();
		if ( ! in_array( $perfil, array( 'equipe', 'unidade' ), true ) ) {
			return array( 'avisos' => array(), 'naoLidos' => 0, 'pedidosAbertos' => 0 );
		}
		$tb = self::t();
		if ( 'equipe' === $perfil ) {
			$rows = $wpdb->get_results( "SELECT * FROM $tb ORDER BY id DESC LIMIT 80" ); // phpcs:ignore WordPress.DB.PreparedSQL
			$abertos = (int) $wpdb->get_var( "SELECT COUNT(*) FROM $tb WHERE pedido = 1 AND atendido_em IS NULL" ); // phpcs:ignore WordPress.DB.PreparedSQL
			$nao     = (int) $wpdb->get_var( "SELECT COUNT(*) FROM $tb WHERE para = 'equipe' AND lido_em IS NULL" ); // phpcs:ignore WordPress.DB.PreparedSQL
			$lado    = 'equipe';
		} else {
			$un = Cronograma_EAD_Service::unidades_do_usuario();
			if ( ! $un ) {
				return array( 'avisos' => array(), 'naoLidos' => 0, 'pedidosAbertos' => 0 );
			}
			$ph      = implode( ',', array_fill( 0, count( $un ), '%s' ) );
			$rows    = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM $tb WHERE unidade_id IN ($ph) AND (para = 'unidade' OR pedido = 1) ORDER BY id DESC LIMIT 80", $un ) ); // phpcs:ignore WordPress.DB.PreparedSQL
			$abertos = (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM $tb WHERE unidade_id IN ($ph) AND pedido = 1 AND atendido_em IS NULL", $un ) ); // phpcs:ignore WordPress.DB.PreparedSQL
			$nao     = (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM $tb WHERE unidade_id IN ($ph) AND para = 'unidade' AND lido_em IS NULL", $un ) ); // phpcs:ignore WordPress.DB.PreparedSQL
			$lado    = 'unidade';
		}
		$out = array();
		foreach ( (array) $rows as $a ) {
			$out[] = self::fmt( $a, $lado );
		}
		return array( 'avisos' => $out, 'naoLidos' => $nao, 'pedidosAbertos' => $abertos );
	}

	/** Marca como lidos: {ids:[..]} | {turma:'id'} | {todos:true}. Só avisos endereçados ao lado do usuário. */
	public static function marcar_lidos( $body ) {
		global $wpdb;
		$perfil = Cronograma_EAD_Service::perfil();
		if ( ! in_array( $perfil, array( 'equipe', 'unidade' ), true ) ) {
			return new WP_Error( 'cronograma_ead_sem_permissao', 'Sem permissão.', array( 'status' => 403 ) );
		}
		$tb   = self::t();
		$u    = wp_get_current_user();
		$cond = array( $wpdb->prepare( 'para = %s', 'equipe' === $perfil ? 'equipe' : 'unidade' ), 'lido_em IS NULL' );
		if ( 'unidade' === $perfil ) {
			$un = Cronograma_EAD_Service::unidades_do_usuario();
			if ( ! $un ) {
				return array( 'ok' => true );
			}
			$cond[] = $wpdb->prepare( 'unidade_id IN (' . implode( ',', array_fill( 0, count( $un ), '%s' ) ) . ')', $un ); // phpcs:ignore WordPress.DB.PreparedSQL
		}
		if ( ! empty( $body['ids'] ) && is_array( $body['ids'] ) ) {
			$ids    = array_map( 'intval', $body['ids'] );
			$cond[] = 'id IN (' . implode( ',', $ids ) . ')';
		} elseif ( ! empty( $body['turma'] ) ) {
			$cond[] = $wpdb->prepare( 'turma_id = %s', sanitize_text_field( $body['turma'] ) );
		} elseif ( empty( $body['todos'] ) ) {
			return array( 'ok' => true );
		}
		$wpdb->query( $wpdb->prepare( "UPDATE $tb SET lido_em = %s, lido_por = %s WHERE " . implode( ' AND ', $cond ), Cronograma_EAD_DB::agora(), $u->display_name ) ); // phpcs:ignore WordPress.DB.PreparedSQL
		return array( 'ok' => true );
	}

	public static function atender( $id ) {
		global $wpdb;
		if ( 'equipe' !== Cronograma_EAD_Service::perfil() ) {
			return new WP_Error( 'cronograma_ead_sem_permissao', 'Só a Unidigit@l marca pedidos como atendidos.', array( 'status' => 403 ) );
		}
		$a = $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . self::t() . ' WHERE id = %d', (int) $id ) ); // phpcs:ignore WordPress.DB.PreparedSQL
		if ( ! $a || ! $a->pedido ) {
			return new WP_Error( 'cronograma_ead_nao_achou', 'Pedido não encontrado.', array( 'status' => 404 ) );
		}
		$u = wp_get_current_user();
		$wpdb->update( self::t(), array( 'atendido_em' => Cronograma_EAD_DB::agora(), 'atendido_por' => $u->display_name, 'lido_em' => $a->lido_em ? $a->lido_em : Cronograma_EAD_DB::agora(), 'lido_por' => $a->lido_em ? $a->lido_por : $u->display_name ), array( 'id' => (int) $id ) );
		$row = Cronograma_EAD_DB::get( $a->turma_id );
		if ( $row ) {
			Cronograma_EAD_DB::log( $row->id, $row->versao, 'pedido_atendido', 'Pedido da unidade marcado como atendido.' );
		}
		return self::listar();
	}
}
