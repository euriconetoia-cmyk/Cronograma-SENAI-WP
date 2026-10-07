<?php
/**
 * Tabelas do sistema: turmas, versões validadas e histórico.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Cronograma_EAD_DB {

	const VERSION = '3';
	const OPT     = 'cronograma_ead_db';

	public static function t( $nome ) {
		global $wpdb;
		return $wpdb->prefix . 'ce_' . $nome;
	}

	public static function install() {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		$c = $wpdb->get_charset_collate();
		dbDelta(
			'CREATE TABLE ' . self::t( 'turmas' ) . " (
  id varchar(64) NOT NULL,
  unidade_id varchar(64) NOT NULL DEFAULT '',
  status varchar(20) NOT NULL DEFAULT 'elaboracao',
  versao int(11) NOT NULL DEFAULT 1,
  rev int(11) NOT NULL DEFAULT 1,
  prazo date DEFAULT NULL,
  data longtext NOT NULL,
  criado_em datetime NOT NULL,
  atualizado_em datetime NOT NULL,
  atualizado_por bigint(20) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY  (id),
  KEY unidade_id (unidade_id),
  KEY status (status),
  KEY unidade_status (unidade_id,status),
  KEY status_prazo (status,prazo)
) $c;"
		);
		dbDelta(
			'CREATE TABLE ' . self::t( 'versoes' ) . " (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  turma_id varchar(64) NOT NULL,
  versao int(11) NOT NULL,
  snapshot longtext NOT NULL,
  validado_por bigint(20) unsigned NOT NULL DEFAULT 0,
  validado_nome varchar(190) NOT NULL DEFAULT '',
  validado_em datetime NOT NULL,
  ressalva text NULL,
  PRIMARY KEY  (id),
  UNIQUE KEY turma_versao (turma_id,versao),
  KEY turma_id (turma_id)
) $c;"
		);
		dbDelta(
			'CREATE TABLE ' . self::t( 'log' ) . " (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  turma_id varchar(64) NOT NULL,
  versao int(11) NOT NULL DEFAULT 1,
  user_id bigint(20) unsigned NOT NULL DEFAULT 0,
  user_nome varchar(190) NOT NULL DEFAULT '',
  perfil varchar(20) NOT NULL DEFAULT '',
  acao varchar(30) NOT NULL,
  motivo text NULL,
  detalhe longtext NULL,
  criado_em datetime NOT NULL,
  PRIMARY KEY  (id),
  KEY turma_id (turma_id),
  KEY turma_criado (turma_id,criado_em),
  KEY criado_em (criado_em)
) $c;"
		);
		dbDelta(
			'CREATE TABLE ' . self::t( 'audit' ) . " (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  request_id varchar(64) NOT NULL DEFAULT '',
  user_id bigint(20) unsigned NOT NULL DEFAULT 0,
  user_nome varchar(190) NOT NULL DEFAULT '',
  acao varchar(64) NOT NULL,
  entidade varchar(32) NOT NULL DEFAULT '',
  entidade_id varchar(190) NOT NULL DEFAULT '',
  resultado varchar(32) NOT NULL DEFAULT '',
  motivo text NULL,
  detalhe longtext NULL,
  criado_em datetime NOT NULL,
  PRIMARY KEY  (id),
  KEY user_id (user_id),
  KEY acao (acao),
  KEY criado_em (criado_em)
) $c;"
		);
		Cronograma_EAD_Avisos::install();
		update_option( self::OPT, self::VERSION, false );
	}

	public static function begin() {
		global $wpdb;
		return false !== $wpdb->query( 'START TRANSACTION' );
	}

	public static function commit() {
		global $wpdb;
		return false !== $wpdb->query( 'COMMIT' );
	}

	public static function rollback() {
		global $wpdb;
		return false !== $wpdb->query( 'ROLLBACK' );
	}

	public static function agora() {
		return gmdate( 'Y-m-d H:i:s' );
	}

	public static function contar() {
		global $wpdb;
		return (int) $wpdb->get_var( 'SELECT COUNT(*) FROM ' . self::t( 'turmas' ) ); // phpcs:ignore WordPress.DB.PreparedSQL
	}

	public static function get( $id ) {
		global $wpdb;
		return $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . self::t( 'turmas' ) . ' WHERE id = %s', $id ) ); // phpcs:ignore WordPress.DB.PreparedSQL
	}

	/** @param array|null $unidades null = todas. */
	public static function listar( $unidades = null ) {
		global $wpdb;
		$tb = self::t( 'turmas' );
		if ( null === $unidades ) {
			return $wpdb->get_results( "SELECT * FROM $tb ORDER BY criado_em ASC" ); // phpcs:ignore WordPress.DB.PreparedSQL
		}
		if ( ! $unidades ) {
			return array();
		}
		$ph = implode( ',', array_fill( 0, count( $unidades ), '%s' ) );
		return $wpdb->get_results( $wpdb->prepare( "SELECT * FROM $tb WHERE unidade_id IN ($ph) ORDER BY criado_em ASC", $unidades ) ); // phpcs:ignore WordPress.DB.PreparedSQL
	}

	public static function inserir( array $turma, $status, $user_id ) {
		global $wpdb;
		$unid = isset( $turma['unidadeId'] ) ? $turma['unidadeId'] : '';
		$now  = self::agora();
		unset( $turma['unidadeId'] );
		foreach ( Cronograma_EAD_Rules::META as $k ) {
			unset( $turma[ $k ] );
		}
		$ok = $wpdb->insert(
			self::t( 'turmas' ),
			array(
				'id'             => $turma['id'],
				'unidade_id'     => $unid,
				'status'         => $status,
				'versao'         => 1,
				'rev'            => 1,
				'data'           => wp_json_encode( Cronograma_EAD_Rules::para_saida( $turma ) ),
				'criado_em'      => $now,
				'atualizado_em'  => $now,
				'atualizado_por' => (int) $user_id,
			)
		);
		return false !== $ok;
	}

	/**
	 * Atualiza só se a revisão for a esperada. Devolve true se gravou.
	 *
	 * @param array $campos status, versao, prazo (string|null), unidade_id, data (array sem metadados).
	 */
	public static function atualizar( $id, $rev, array $campos, $user_id ) {
		global $wpdb;
		$sets = array( 'rev = rev + 1', 'atualizado_em = %s', 'atualizado_por = %d' );
		$args = array( self::agora(), (int) $user_id );
		if ( isset( $campos['data'] ) ) {
			$d = $campos['data'];
			unset( $d['unidadeId'] );
			foreach ( Cronograma_EAD_Rules::META as $k ) {
				unset( $d[ $k ] );
			}
			$sets[] = 'data = %s';
			$args[] = wp_json_encode( Cronograma_EAD_Rules::para_saida( $d ) );
		}
		foreach ( array( 'status' => '%s', 'versao' => '%d', 'unidade_id' => '%s' ) as $col => $fmt ) {
			if ( array_key_exists( $col, $campos ) ) {
				$sets[] = "$col = $fmt";
				$args[] = $campos[ $col ];
			}
		}
		if ( array_key_exists( 'prazo', $campos ) ) {
			if ( $campos['prazo'] ) {
				$sets[] = 'prazo = %s';
				$args[] = $campos['prazo'];
			} else {
				$sets[] = 'prazo = NULL';
			}
		}
		$args[] = $id;
		$args[] = (int) $rev;
		$sql    = 'UPDATE ' . self::t( 'turmas' ) . ' SET ' . implode( ', ', $sets ) . ' WHERE id = %s AND rev = %d';
		$wpdb->query( $wpdb->prepare( $sql, $args ) ); // phpcs:ignore WordPress.DB.PreparedSQL
		return 1 === (int) $wpdb->rows_affected;
	}

	public static function excluir( $id ) {
		global $wpdb;
		$wpdb->delete( self::t( 'turmas' ), array( 'id' => $id ) );
		// O histórico e as versões ficam guardados de propósito.
	}

	public static function limpar_dados_teste() {
		global $wpdb;
		if ( ! self::begin() ) {
			return new WP_Error( 'cronograma_ead_reset', 'Não foi possível iniciar a limpeza.', array( 'status' => 500 ) );
		}
		try {
			foreach ( array( 'avisos', 'log', 'versoes', 'turmas' ) as $tabela ) {
				$ok = $wpdb->query( 'DELETE FROM ' . self::t( $tabela ) ); // phpcs:ignore WordPress.DB.PreparedSQL
				if ( false === $ok ) {
					throw new RuntimeException( 'Falha ao limpar a tabela ' . $tabela . '.' );
				}
			}
			if ( ! self::commit() ) {
				throw new RuntimeException( 'Falha ao confirmar a limpeza.' );
			}
			self::audit_admin( 'reset_dados_teste', 'sistema', '', 'ok', array( 'escopo' => array( 'cursos', 'turmas', 'versoes', 'historico', 'avisos' ) ) );
			return true;
		} catch ( Throwable $e ) {
			self::rollback();
			return new WP_Error( 'cronograma_ead_reset', $e->getMessage(), array( 'status' => 500 ) );
		}
	}

	/* ---------- versões ---------- */

	public static function salvar_versao( $turma_id, $versao, $snapshot, $user_id, $nome, $ressalva ) {
		global $wpdb;
		return false !== $wpdb->insert(
			self::t( 'versoes' ),
			array(
				'turma_id'      => $turma_id,
				'versao'        => (int) $versao,
				'snapshot'      => wp_json_encode( $snapshot ),
				'validado_por'  => (int) $user_id,
				'validado_nome' => $nome,
				'validado_em'   => self::agora(),
				'ressalva'      => $ressalva,
			)
		);
	}

	public static function versoes( $turma_id ) {
		global $wpdb;
		return $wpdb->get_results( $wpdb->prepare( 'SELECT versao, validado_nome, validado_em, ressalva FROM ' . self::t( 'versoes' ) . ' WHERE turma_id = %s ORDER BY versao DESC', $turma_id ) ); // phpcs:ignore WordPress.DB.PreparedSQL
	}

	public static function versao( $turma_id, $versao ) {
		global $wpdb;
		return $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . self::t( 'versoes' ) . ' WHERE turma_id = %s AND versao = %d', $turma_id, (int) $versao ) ); // phpcs:ignore WordPress.DB.PreparedSQL
	}

	/** Última versão validada de cada turma: [turma_id => row]. */
	public static function vigentes() {
		global $wpdb;
		$tv   = self::t( 'versoes' );
		$rows = $wpdb->get_results( "SELECT v.turma_id, v.versao, v.validado_nome, v.validado_em, v.ressalva FROM $tv v INNER JOIN (SELECT turma_id, MAX(versao) mv FROM $tv GROUP BY turma_id) m ON v.turma_id = m.turma_id AND v.versao = m.mv" ); // phpcs:ignore WordPress.DB.PreparedSQL
		$out  = array();
		foreach ( (array) $rows as $r ) {
			$out[ $r->turma_id ] = $r;
		}
		return $out;
	}

	/* ---------- histórico ---------- */

	public static function log( $turma_id, $versao, $acao, $motivo = '', $detalhe = null ) {
		global $wpdb;
		$u = wp_get_current_user();
		$ok = $wpdb->insert(
			self::t( 'log' ),
			array(
				'turma_id'  => $turma_id,
				'versao'    => (int) $versao,
				'user_id'   => (int) $u->ID,
				'user_nome' => $u->ID ? $u->display_name : 'Sistema',
				'perfil'    => $u->ID ? Cronograma_EAD_Service::perfil( $u->ID ) : 'sistema',
				'acao'      => $acao,
				'motivo'    => $motivo,
				'detalhe'   => null === $detalhe ? null : wp_json_encode( $detalhe ),
				'criado_em' => self::agora(),
			)
		);
		return false !== $ok;
	}

	public static function audit_admin( $acao, $entidade = '', $entidade_id = '', $resultado = 'ok', $detalhe = null, $motivo = '' ) {
		global $wpdb;
		$u = wp_get_current_user();
		return false !== $wpdb->insert(
			self::t( 'audit' ),
			array(
				'request_id' => Cronograma_EAD_Security::request_id(),
				'user_id' => (int) $u->ID,
				'user_nome' => $u->ID ? $u->display_name : 'Sistema',
				'acao' => sanitize_key( $acao ),
				'entidade' => sanitize_key( $entidade ),
				'entidade_id' => sanitize_text_field( (string) $entidade_id ),
				'resultado' => sanitize_key( $resultado ),
				'motivo' => sanitize_text_field( (string) $motivo ),
				'detalhe' => null === $detalhe ? null : wp_json_encode( $detalhe ),
				'criado_em' => self::agora(),
			)
		);
	}

	public static function audit_recent( $limit = 50 ) {
		global $wpdb;
		return $wpdb->get_results( $wpdb->prepare( 'SELECT id, request_id, user_id, user_nome, acao, entidade, entidade_id, resultado, motivo, detalhe, criado_em FROM ' . self::t( 'audit' ) . ' ORDER BY id DESC LIMIT %d', max( 1, min( 500, (int) $limit ) ) ) ); // phpcs:ignore WordPress.DB.PreparedSQL
	}

	public static function historico( $turma_id, $limite = 300 ) {
		global $wpdb;
		return $wpdb->get_results( $wpdb->prepare( 'SELECT id, versao, user_nome, perfil, acao, motivo, detalhe, criado_em FROM ' . self::t( 'log' ) . ' WHERE turma_id = %s ORDER BY id DESC LIMIT %d', $turma_id, (int) $limite ) ); // phpcs:ignore WordPress.DB.PreparedSQL
	}

	/** Últimos registros de todas as turmas (o Service filtra o que cada perfil pode ver). */
	public static function atividade( $limite = 60 ) {
		global $wpdb;
		return $wpdb->get_results( $wpdb->prepare( 'SELECT id, turma_id, versao, user_nome, perfil, acao, motivo, criado_em FROM ' . self::t( 'log' ) . ' ORDER BY id DESC LIMIT %d', (int) $limite ) ); // phpcs:ignore WordPress.DB.PreparedSQL
	}

	public static function tem_log( $turma_id, $versao, $acao ) {
		global $wpdb;
		return (int) $wpdb->get_var( $wpdb->prepare( 'SELECT COUNT(*) FROM ' . self::t( 'log' ) . ' WHERE turma_id = %s AND versao = %d AND acao = %s', $turma_id, (int) $versao, $acao ) ) > 0; // phpcs:ignore WordPress.DB.PreparedSQL
	}
}
