import type { Curso, Encontro, Feriado, Item, ItemTurma, Modulo, Turma } from './types'

/* ---------- datas: dias inteiros em UTC, sem fuso ---------- */
export const toN = (s: string) => { const p = s.split('-'); return Math.round(Date.UTC(+p[0], +p[1] - 1, +p[2]) / 864e5) }
export const toS = (n: number) => { const d = new Date(n * 864e5); return d.toISOString().slice(0, 10) }
export const dow = (n: number) => new Date(n * 864e5).getUTCDay()
export const todayStr = () => { const d = new Date(); const m = d.getMonth() + 1, dd = d.getDate(); return `${d.getFullYear()}-${m < 10 ? '0' : ''}${m}-${dd < 10 ? '0' : ''}${dd}` }
const WD = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
export const wdName = (s: string) => WD[dow(toN(s))]
export const fmt = (s?: string | null) => { if (!s) return ''; const p = s.split('-'); return `${p[2]}/${p[1]}/${p[0].slice(2)} · ${wdName(s)}` }
export const fmtShort = (s?: string | null) => { if (!s) return ''; const p = s.split('-'); return `${p[2]}/${p[1]}/${p[0].slice(2)}` }
export const br = (s?: string | null) => { if (!s) return ''; const p = s.split('-'); return `${p[2]}/${p[1]}/${p[0]}` }

/** WORKDAY do Excel: ignora sábado, domingo e feriados; a data inicial não conta. */
export function workday(s: string, n: number, hol: Set<string> | null): string {
  let d = toN(s), left = n
  while (left > 0) {
    d++
    const w = dow(d)
    if (w === 0 || w === 6) continue
    if (hol && hol.has(toS(d))) continue
    left--
  }
  return toS(d)
}

export interface Calc { H: number; I: number; J: string | null; K: string | null; L: string | null; nenc: number }
export interface Row { m: Modulo; it: Item; first: boolean; c: Calc }
export interface Result { curso: Curso; rows: Row[]; by: Record<string, Row>; end: string | null; sumUC: number; nUC: number }

/** Feriados que valem para a turma: os gerais e os da unidade dela. */
export const feriadosDaTurma = (t: { unidadeId: string }, feriados: Feriado[]) => feriados.filter(f => !f[2] || f[2] === t.unidadeId)

export function compute(t: Pick<Turma, 'inicio' | 'unidadeId'>, curso: Curso, feriados: Feriado[]): Result {
  const hol = new Set(feriadosDaTurma(t, feriados).map(f => f[0]))
  const rows: Row[] = []
  const by: Record<string, Row> = {}
  let lastMain: Row | null = null, lastUC: Row | null = null, prev: Row | null = null
  ;(curso.modulos || []).forEach(m => (m.itens || []).forEach((it, ix) => {
    const H = (+it.ch || 0) - (+it.pres || 0)
    const I = H !== 21 ? Math.ceil(H / (+it.div || 3)) : 7
    let J: string | null = null
    if (it.tipo === 'intro' || !rows.length) J = t.inicio || null
    else {
      const ref = it.tipo === 'uc' ? lastMain : it.tipo === 'rec' ? lastUC : prev
      J = ref && ref.c.K ? workday(ref.c.K, 1, hol) : null
    }
    const K = J ? workday(J, I, hol) : null
    const nenc = it.tipo === 'uc' ? Math.ceil((+it.pres || 0) / (+curso.regras?.hEncontro || 8)) : it.tipo === 'intro' ? ((+it.pres || 0) > 0 ? 1 : 0) : 0
    const row: Row = { m, it, first: ix === 0, c: { H, I, J, K, L: null, nenc } }
    rows.push(row); by[it.id] = row
    if (it.tipo === 'uc' || it.tipo === 'mat' || it.tipo === 'intro') lastMain = row
    if (it.tipo === 'uc') lastUC = row
    prev = row
  }))
  ;(curso.modulos || []).forEach(m => {
    if (!m.itens?.length) return
    const mat = m.itens.find(i => i.tipo === 'mat')
    const end = by[(mat || m.itens[m.itens.length - 1]).id].c.K
    m.itens.forEach(i => { by[i.id].c.L = end })
  })
  let end: string | null = null, sumUC = 0, nUC = 0
  rows.forEach(r => { if (r.c.K && (!end || r.c.K > end)) end = r.c.K; if (r.it.tipo === 'uc') { sumUC += +r.it.ch || 0; nUC++ } })
  return { curso, rows, by, end, sumUC, nUC }
}

/** Encontros de uma etapa, sem alterar o estado (completa com linhas vazias). */
export function encontros(t: Pick<Turma, 'itens'>, r: Row, curso: Curso): Encontro[] {
  const st: ItemTurma = t.itens[r.it.id] || {}
  const R = curso.regras
  if (r.it.tipo === 'intro') return r.c.nenc > 0 ? [{ d: r.c.J || '', h: R.horario, w: R.webHora }] : []
  if (r.it.tipo !== 'uc') return []
  const base = (st.enc || []).slice(0, r.c.nenc)
  while (base.length < r.c.nenc) base.push({ d: '', h: R.horario, w: R.webHora })
  return base
}

/**
 * Sugere as datas dos encontros presenciais de uma etapa: sábados dentro do período da etapa
 * (de J a K), fora de feriados e espaçados de forma regular. Se faltarem sábados no período,
 * completa com os seguintes.
 */
export function sugerirEncontros(J: string, K: string | null, n: number, hol: Set<string>): string[] {
  if (n <= 0) return []
  const ini = toN(J), fim = K ? toN(K) : ini
  const ok = (d: number) => dow(d) === 6 && !hol.has(toS(d))
  const sats: number[] = []
  for (let d = ini; d <= fim; d++) if (ok(d)) sats.push(d)
  for (let d = fim + 1; sats.length < n && d < fim + 400; d++) if (ok(d)) sats.push(d)
  const pick = n === 1 ? [sats[0]] : Array.from({ length: n }, (_, i) => sats[Math.round(i * (Math.min(sats.length, Math.max(n, sats.length)) - 1) / (n - 1))])
  return pick.filter(x => x !== undefined).map(toS)
}

/** Calcula os encontros de todas as etapas a partir do início da turma. `so_vazios` preserva as datas já digitadas. */
export function planejarEncontros(t: Pick<Turma, 'itens' | 'unidadeId'>, G: Result, feriados: Feriado[], soVazios: boolean): Record<string, Encontro[]> {
  const hol = new Set(feriadosDaTurma(t, feriados).map(f => f[0]))
  const out: Record<string, Encontro[]> = {}
  for (const r of G.rows) {
    if (r.it.tipo !== 'uc' || !r.c.J) continue
    const atual = encontros(t, r, G.curso)
    const sug = sugerirEncontros(r.c.J, r.c.K, r.c.nenc, hol)
    const novo = atual.map((e, i) => (soVazios && e.d) ? e : { ...e, d: sug[i] || e.d })
    if (novo.some((e, i) => e.d !== atual[i].d)) out[r.it.id] = novo
  }
  return out
}

/** `ref` aponta o encontro com problema (para pintar a data de vermelho e corrigir); `dt` é o trecho do texto que vai em vermelho. */
export type Aviso = { nivel: 'ok' | 'warn' | 'bad'; area: string; texto: string; ref?: { item: string; ix: number }; dt?: string; campo?: 'fim' }
export function verificar(t: Turma, G: Result, todos: Feriado[]): Aviso[] {
  const out: Aviso[] = []
  const feriados = feriadosDaTurma(t, todos)
  const hol = new Set(feriados.map(f => f[0]))
  if (!t.inicio) out.push({ nivel: 'bad', area: 'Turma', texto: 'Informe a data de início da turma na página Turmas.' })
  if (G.sumUC === +G.curso.chTotal) out.push({ nivel: 'ok', area: 'Carga horária', texto: `${G.sumUC} h nas unidades curriculares, igual à carga horária total do curso.` })
  else out.push({ nivel: 'bad', area: 'Carga horária', texto: `As unidades curriculares somam ${G.sumUC} h, mas o curso tem ${G.curso.chTotal} h. Recuperação, Matrícula e o curso introdutório não entram na soma.` })
  const last = feriados.reduce((m, h) => (h[0] > m ? h[0] : m), '0000')
  if (G.end && G.end > last) out.push({ nivel: 'bad', area: 'Feriados', texto: `O cronograma termina em ${fmtShort(G.end)}, depois do último feriado cadastrado (${fmtShort(last)}). Cadastre os feriados desse período para os prazos ficarem corretos.`, dt: fmtShort(G.end), campo: 'fim' })
  G.rows.forEach(r => {
    if (r.it.tipo !== 'uc') return
    let prev = ''
    encontros(t, r, G.curso).forEach((e, ix) => {
      const n = `${ix + 1}º encontro de ${r.it.nome}`
      const ref = { item: r.it.id, ix }
      if (!e.d) { out.push({ nivel: 'warn', area: 'Encontros', texto: `${n} está sem data.`, ref, dt: 'sem data' }); return }
      const dn = toN(e.d), w = dow(dn), dt = fmtShort(e.d)
      if (w !== 6) out.push({ nivel: 'warn', area: 'Encontros', texto: `${n} cai em ${wdName(e.d)} (${dt}). Os encontros deste curso costumam ser aos sábados.`, ref, dt })
      if (hol.has(e.d)) out.push({ nivel: 'warn', area: 'Encontros', texto: `${n} cai em um dia cadastrado como feriado ou férias (${dt}).`, ref, dt })
      if (r.c.J && r.c.K && (e.d < r.c.J || e.d > r.c.K)) out.push({ nivel: 'warn', area: 'Encontros', texto: `${n} (${dt}) fica fora do período da UC, de ${fmtShort(r.c.J)} a ${fmtShort(r.c.K)}.`, ref, dt })
      if (prev && e.d <= prev) out.push({ nivel: 'warn', area: 'Encontros', texto: `${n} (${dt}) precisa ser depois do encontro anterior.`, ref, dt })
      prev = e.d
    })
  })
  return out
}

export type Situacao = 'concluida' | 'andamento' | 'aIniciar' | 'semData'
export function situacao(r: Row, hoje: string): Situacao {
  if (!r.c.J || !r.c.K) return 'semData'
  if (hoje > r.c.K) return 'concluida'
  if (hoje >= r.c.J) return 'andamento'
  return 'aIniciar'
}

/** Chaves "item:índice" dos encontros com data a corrigir. */
export const encontrosRuins = (avisos: Aviso[]) => new Set(avisos.filter(a => a.ref).map(a => `${a.ref!.item}:${a.ref!.ix}`))

/**
 * Corrige só os encontros com problema: troca a data pelo sábado livre mais próximo, dentro do período da etapa,
 * fora de feriados e depois do encontro anterior. As datas que já estão certas não mudam.
 * `so` limita a correção a um encontro ("item:índice").
 */
export function corrigirEncontros(t: Pick<Turma, 'itens' | 'unidadeId'>, G: Result, feriados: Feriado[], ruins: Set<string>, so?: string): Record<string, Encontro[]> {
  const hol = new Set(feriadosDaTurma(t, feriados).map(f => f[0]))
  const out: Record<string, Encontro[]> = {}
  for (const r of G.rows) {
    if (r.it.tipo !== 'uc' || !r.c.J) continue
    const atual = encontros(t, r, G.curso)
    if (!atual.some((_, i) => ruins.has(`${r.it.id}:${i}`) && (!so || so === `${r.it.id}:${i}`))) continue
    const sug = sugerirEncontros(r.c.J, r.c.K, r.c.nenc, hol)
    const sabados: number[] = []
    for (let d = toN(r.c.J); d <= toN(r.c.K || r.c.J); d++) if (dow(d) === 6 && !hol.has(toS(d))) sabados.push(d)
    const novo = atual.map(e => ({ ...e }))
    let prev = ''
    novo.forEach((e, i) => {
      const k = `${r.it.id}:${i}`
      if (ruins.has(k) && (!so || so === k)) {
        const usadas = new Set(novo.filter((_, j) => j !== i).map(x => x.d))
        const livres = sabados.filter(d => toS(d) > prev && !usadas.has(toS(d)))
        const alvo = e.d ? toN(e.d) : sug[i] ? toN(sug[i]) : 0
        const melhor = livres.sort((a, b) => Math.abs(a - alvo) - Math.abs(b - alvo))[0]
        e.d = melhor !== undefined ? toS(melhor) : (sug[i] || e.d)
      }
      prev = e.d || prev
    })
    out[r.it.id] = novo
  }
  return out
}

/** A etapa tem carga horária presencial? Sem ela não existe encontro, data nem horário presencial. */
export const temPres = (it: { tipo: string; pres?: number | string }) => (it.tipo === 'uc' || it.tipo === 'intro') && (+(it.pres ?? 0) || 0) > 0
/** O curso tem alguma etapa com carga presencial? */
export const cursoTemPres = (curso: { modulos?: { itens?: { tipo: string; pres?: number | string }[] }[] }) => (curso.modulos || []).some(m => (m.itens || []).some(temPres))
