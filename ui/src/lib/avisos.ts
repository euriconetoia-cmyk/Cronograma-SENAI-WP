import type { Aviso } from './types'

/** Aba do cronograma pedida por outro ponto da tela (ex.: clique no sino). Lida quando o Cronograma abre. */
export const abaPedida = { v: '' }
export const pedirAba = (a: string) => { abaPedida.v = a; window.dispatchEvent(new CustomEvent('ce-cron-aba', { detail: a })) }

export const ROTULO_SUB: Record<string, string> = { alteracao: 'Alteração', reabertura: 'Reabertura', duvida: 'Dúvida' }

/** Pedido ainda sem resposta da Unidigit@l. */
export const pedidoAberto = (a: Aviso) => a.pedido && !a.atendidoEm
