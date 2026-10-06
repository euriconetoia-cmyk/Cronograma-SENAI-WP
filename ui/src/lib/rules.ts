import type { AcaoNome, Perfil, Status, Turma } from './types'

/** Espelho das regras do servidor (class-rules.php). O servidor é quem decide; aqui serve para a tela mostrar só o que cabe. */
export const ACOES: Record<AcaoNome, { de: Status[]; para: Status | null; perfis: Perfil[]; motivo: boolean }> = {
  iniciar: { de: ['solicitado'], para: 'elaboracao', perfis: ['equipe'], motivo: false },
  enviar: { de: ['elaboracao'], para: 'validacao', perfis: ['equipe'], motivo: false },
  recolher: { de: ['validacao'], para: 'elaboracao', perfis: ['equipe'], motivo: true },
  validar: { de: ['validacao'], para: 'validado', perfis: ['unidade', 'equipe'], motivo: false },
  reabrir: { de: ['validado'], para: 'validacao', perfis: ['equipe'], motivo: true },
  arquivar: { de: ['solicitado', 'elaboracao', 'validado'], para: 'arquivado', perfis: ['equipe'], motivo: true },
  restaurar: { de: ['arquivado'], para: 'elaboracao', perfis: ['equipe'], motivo: false },
  comentar: { de: ['solicitado', 'elaboracao', 'validacao', 'validado'], para: null, perfis: ['unidade', 'equipe'], motivo: true },
}

export function checarAcao(acao: AcaoNome, status: Status, perfil: Perfil, validador: boolean, motivo: string): true | string {
  const d = ACOES[acao]
  if (!d) return 'acao_invalida'
  if (!d.perfis.includes(perfil)) return 'sem_permissao'
  if (!d.de.includes(status)) return 'status_incompativel'
  if (acao === 'validar' && perfil === 'unidade' && !validador) return 'nao_validador'
  if ((d.motivo || (acao === 'validar' && perfil === 'equipe')) && !motivo.trim()) return 'motivo_obrigatorio'
  return true
}

export const podeEditar = (status: Status, perfil: Perfil) =>
  perfil === 'equipe' ? ['solicitado', 'elaboracao', 'validacao'].includes(status) : perfil === 'unidade' ? status === 'validacao' : false

/** Ações que o perfil enxerga naquele status (a justificativa é pedida depois). */
export const acoesDisponiveis = (status: Status, perfil: Perfil, validador: boolean): AcaoNome[] =>
  (Object.keys(ACOES) as AcaoNome[]).filter(a => {
    const r = checarAcao(a, status, perfil, true, 'x')
    if (r !== true) return false
    if (a === 'validar' && perfil === 'unidade' && !validador) return false
    return true
  })

export const UNIT_TOP = ['ambiente', 'profId', 'coordId'] as const
export const UNIT_ITEM = ['enc', 'ambiente', 'profId', 'coordId'] as const

type Obj = Record<string, unknown>
const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o))

export function mergeUnidade(stored: Obj, incoming: Obj, itemIds: string[] | null): Obj {
  const out = clone(stored) as Obj
  for (const k of UNIT_TOP) if (k in incoming) out[k] = String(incoming[k] ?? '')
  const inI = (incoming.itens || {}) as Record<string, Obj>
  const outI = ((out.itens as Record<string, Obj>) ||= {})
  for (const id of Object.keys(inI)) {
    if (itemIds && !itemIds.includes(id)) continue
    const it = inI[id]
    outI[id] ||= {}
    for (const k of UNIT_ITEM) {
      if (!(k in it)) continue
      outI[id][k] = k === 'enc' ? (it.enc as Obj[]).slice(0, 40).map(e => ({ d: String(e.d ?? ''), h: String(e.h ?? ''), w: String(e.w ?? '') })) : String(it[k] ?? '')
    }
  }
  return out
}

function flat(v: unknown, p = '', o: Record<string, string> = {}) {
  if (v && typeof v === 'object') for (const [k, x] of Object.entries(v as Obj)) flat(x, p ? `${p}.${k}` : k, o)
  else o[p] = v == null ? '' : String(v)
  return o
}
export function diff(a: Obj, b: Obj) {
  const fa = flat(a), fb = flat(b), out: { campo: string; de: string; para: string }[] = []
  for (const k of new Set([...Object.keys(fa), ...Object.keys(fb)])) if ((fa[k] ?? '') !== (fb[k] ?? '')) out.push({ campo: k, de: fa[k] ?? '', para: fb[k] ?? '' })
  return out
}
export const mudouData = (c: { campo: string }[]) => c.some(x => /\.enc\.\d+\.d$/.test(x.campo))

/** Campos que a unidade pode ajustar: encontros, ambiente, professor e coordenador. */
export const CAMPOS_UNIDADE = new Set(['enc', 'ambiente', 'profId', 'coordId'])

export type Meta = Pick<Turma, 'status'>
