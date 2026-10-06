<?php
/**
 * Regras do fluxo de validação. Sem dependência do WordPress, para poder ser testado sozinho.
 *
 * Status:  solicitado -> elaboracao -> validacao -> validado
 *                                  ^------ (recolher)   |
 *                                  validacao <-- (reabrir, só a Unidigit@l)
 */

if ( ! defined( 'ABSPATH' ) && ! defined( 'CRONOGRAMA_EAD_TESTING' ) ) {
	exit;
}

class Cronograma_EAD_Rules {

	const S_SOLICITADO = 'solicitado';
	const S_ELABORACAO = 'elaboracao';
	const S_VALIDACAO  = 'validacao';
	const S_VALIDADO   = 'validado';
	const S_ARQUIVADO  = 'arquivado';

	/** Campos que a unidade escolar pode ajustar, no nível da turma e no de cada etapa. */
	const UNIT_TOP  = array( 'ambiente', 'profId', 'coordId' );
	const UNIT_ITEM = array( 'enc', 'ambiente', 'profId', 'coordId' );

	/** Campos de metadados que nunca vêm do cliente. */
	const META = array( 'status', 'versao', 'rev', 'prazo', 'vigente' );

	public static function statuses() {
		return array( self::S_SOLICITADO, self::S_ELABORACAO, self::S_VALIDACAO, self::S_VALIDADO, self::S_ARQUIVADO );
	}

	/**
	 * Ações do fluxo: de onde saem, para onde vão, quem pode e se pedem justificativa.
	 * Perfis: equipe (Unidigit@l), unidade, consulta.
	 */
	public static function acoes() {
		return array(
			'iniciar'   => array( 'de' => array( self::S_SOLICITADO ), 'para' => self::S_ELABORACAO, 'perfis' => array( 'equipe' ), 'motivo' => false ),
			'enviar'    => array( 'de' => array( self::S_ELABORACAO ), 'para' => self::S_VALIDACAO, 'perfis' => array( 'equipe' ), 'motivo' => false ),
			'recolher'  => array( 'de' => array( self::S_VALIDACAO ), 'para' => self::S_ELABORACAO, 'perfis' => array( 'equipe' ), 'motivo' => true ),
			'validar'   => array( 'de' => array( self::S_VALIDACAO ), 'para' => self::S_VALIDADO, 'perfis' => array( 'unidade', 'equipe' ), 'motivo' => false ),
			'reabrir'   => array( 'de' => array( self::S_VALIDADO ), 'para' => self::S_VALIDACAO, 'perfis' => array( 'equipe' ), 'motivo' => true ),
			'arquivar'  => array( 'de' => array( self::S_SOLICITADO, self::S_ELABORACAO, self::S_VALIDADO ), 'para' => self::S_ARQUIVADO, 'perfis' => array( 'equipe' ), 'motivo' => true ),
			'restaurar' => array( 'de' => array( self::S_ARQUIVADO ), 'para' => self::S_ELABORACAO, 'perfis' => array( 'equipe' ), 'motivo' => false ),
			// Não muda o status: registra um pedido, por exemplo de mudança que a unidade não pode fazer.
			'comentar'  => array( 'de' => array( self::S_SOLICITADO, self::S_ELABORACAO, self::S_VALIDACAO, self::S_VALIDADO ), 'para' => null, 'perfis' => array( 'unidade', 'equipe' ), 'motivo' => true ),
		);
	}

	/**
	 * @return true|string true se pode; senão o código do erro.
	 */
	public static function checar_acao( $acao, $status, $perfil, $validador, $motivo ) {
		$a = self::acoes();
		if ( ! isset( $a[ $acao ] ) ) {
			return 'acao_invalida';
		}
		$def = $a[ $acao ];
		if ( ! in_array( $perfil, $def['perfis'], true ) ) {
			return 'sem_permissao';
		}
		if ( ! in_array( $status, $def['de'], true ) ) {
			return 'status_incompativel';
		}
		if ( 'validar' === $acao && 'unidade' === $perfil && ! $validador ) {
			return 'nao_validador';
		}
		$precisa = $def['motivo'] || ( 'validar' === $acao && 'equipe' === $perfil );
		if ( $precisa && '' === trim( (string) $motivo ) ) {
			return 'motivo_obrigatorio';
		}
		return true;
	}

	/** Quem pode gravar alterações na turma em cada status. */
	public static function pode_editar( $status, $perfil ) {
		if ( 'equipe' === $perfil ) {
			return in_array( $status, array( self::S_SOLICITADO, self::S_ELABORACAO, self::S_VALIDACAO ), true );
		}
		if ( 'unidade' === $perfil ) {
			return self::S_VALIDACAO === $status;
		}
		return false;
	}

	/* ---------- limpeza ---------- */

	public static function s( $v ) {
		$v = is_scalar( $v ) ? (string) $v : '';
		return function_exists( 'sanitize_text_field' ) ? sanitize_text_field( $v ) : trim( strip_tags( $v ) );
	}

	public static function data_ok( $v ) {
		if ( ! is_string( $v ) || ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $v ) ) {
			return false;
		}
		$d = DateTimeImmutable::createFromFormat( '!Y-m-d', $v, new DateTimeZone( 'UTC' ) );
		$e = DateTimeImmutable::getLastErrors();
		return false !== $d && ( false === $e || ( 0 === $e['warning_count'] && 0 === $e['error_count'] ) ) && $d->format( 'Y-m-d' ) === $v;
	}

	/** Lista de encontros {d,h,w}, no máximo 40. */
	public static function limpar_enc( $enc ) {
		$out = array();
		if ( ! is_array( $enc ) ) {
			return $out;
		}
		foreach ( array_slice( array_values( $enc ), 0, 40 ) as $e ) {
			$e     = is_array( $e ) ? $e : array();
			$d     = isset( $e['d'] ) ? self::s( $e['d'] ) : '';
			$out[] = array(
				'd' => ( '' === $d || self::data_ok( $d ) ) ? $d : '',
				'h' => isset( $e['h'] ) ? self::s( $e['h'] ) : '',
				'w' => isset( $e['w'] ) ? self::s( $e['w'] ) : '',
			);
		}
		return $out;
	}

	/**
	 * A unidade só altera os campos liberados; o resto da turma permanece como estava.
	 *
	 * @param array      $stored   Turma gravada.
	 * @param array      $incoming Turma enviada.
	 * @param array|null $item_ids Etapas que existem no curso (null = não filtra).
	 */
	public static function merge_unidade( array $stored, array $incoming, $item_ids = null ) {
		$out = $stored;
		foreach ( self::UNIT_TOP as $k ) {
			if ( array_key_exists( $k, $incoming ) ) {
				$out[ $k ] = self::s( $incoming[ $k ] );
			}
		}
		$in_itens = ( isset( $incoming['itens'] ) && is_array( $incoming['itens'] ) ) ? $incoming['itens'] : array();
		if ( ! isset( $out['itens'] ) || ! is_array( $out['itens'] ) ) {
			$out['itens'] = array();
		}
		foreach ( $in_itens as $id => $it ) {
			if ( ! is_array( $it ) || ( null !== $item_ids && ! in_array( (string) $id, $item_ids, true ) ) ) {
				continue;
			}
			if ( ! isset( $out['itens'][ $id ] ) || ! is_array( $out['itens'][ $id ] ) ) {
				$out['itens'][ $id ] = array();
			}
			foreach ( self::UNIT_ITEM as $k ) {
				if ( ! array_key_exists( $k, $it ) ) {
					continue;
				}
				$out['itens'][ $id ][ $k ] = ( 'enc' === $k ) ? self::limpar_enc( $it[ $k ] ) : self::s( $it[ $k ] );
			}
		}
		return $out;
	}

	/** A Unidigit@l altera os campos do contrato, menos a identidade e os metadados do fluxo. */
	public static function merge_equipe( array $stored, array $incoming, $item_ids = null ) {
		$out = $incoming;
		foreach ( self::META as $k ) {
			unset( $out[ $k ] );
		}
		$out['id'] = isset( $stored['id'] ) ? $stored['id'] : ( isset( $incoming['id'] ) ? $incoming['id'] : '' );
		if ( ! isset( $out['itens'] ) || ! is_array( $out['itens'] ) ) {
			$out['itens'] = array();
		}
		if ( null !== $item_ids ) {
			$out['itens'] = array_intersect_key( $out['itens'], array_fill_keys( $item_ids, true ) );
		}
		return $out;
	}

	/* ---------- comparação ---------- */

	public static function flatten( $v, $prefix = '', array &$out = array() ) {
		if ( is_array( $v ) ) {
			foreach ( $v as $k => $x ) {
				self::flatten( $x, '' === $prefix ? (string) $k : $prefix . '.' . $k, $out );
			}
		} else {
			$out[ $prefix ] = is_bool( $v ) ? ( $v ? '1' : '' ) : (string) $v;
		}
		return $out;
	}

	/** @return array<int,array{campo:string,de:string,para:string}> */
	public static function diff( array $a, array $b ) {
		$fa   = self::flatten( $a );
		$fb   = self::flatten( $b );
		$keys = array_unique( array_merge( array_keys( $fa ), array_keys( $fb ) ) );
		$out  = array();
		foreach ( $keys as $k ) {
			$x = isset( $fa[ $k ] ) ? $fa[ $k ] : '';
			$y = isset( $fb[ $k ] ) ? $fb[ $k ] : '';
			if ( $x !== $y ) {
				$out[] = array( 'campo' => (string) $k, 'de' => $x, 'para' => $y );
			}
		}
		return $out;
	}

	/** Alguma data de encontro mudou? */
	public static function mudou_data( array $changes ) {
		foreach ( $changes as $c ) {
			if ( preg_match( '/\.enc\.\d+\.d$/', $c['campo'] ) ) {
				return true;
			}
		}
		return false;
	}

	/** "itens" e cada etapa vazia precisam sair como objeto JSON ({}), nunca como lista ([]). */
	public static function para_saida( array $t ) {
		if ( empty( $t['itens'] ) ) {
			$t['itens'] = (object) array();
		} else {
			foreach ( $t['itens'] as $k => $v ) {
				if ( empty( $v ) ) {
					$t['itens'][ $k ] = (object) array();
				}
			}
		}
		return $t;
	}

	/** Soma n dias úteis a uma data AAAA-MM-DD, ignorando fins de semana e feriados informados. */
	public static function somar_uteis( $data, $n, $feriados = array() ) {
		if ( ! self::data_ok( $data ) ) {
			return '';
		}
		$hol = array();
		foreach ( (array) $feriados as $f ) {
			$d = is_array( $f ) ? ( isset( $f[0] ) ? $f[0] : '' ) : $f;
			if ( self::data_ok( $d ) ) {
				$hol[ $d ] = true;
			}
		}
		$ts = strtotime( $data . ' 12:00:00 UTC' );
		$n  = max( 0, (int) $n );
		while ( $n > 0 ) {
			$ts += DAY_IN_SECONDS;
			$w = (int) gmdate( 'w', $ts );
			$d = gmdate( 'Y-m-d', $ts );
			if ( 0 !== $w && 6 !== $w && ! isset( $hol[ $d ] ) ) {
				$n--;
			}
		}
		return gmdate( 'Y-m-d', $ts );
	}
}
