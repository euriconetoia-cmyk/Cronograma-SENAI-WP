import type { Curso, Encontro, Feriado, Item, ItemTurma, Modulo, Turma } from './types'
import { diasEstudoItem, diasPermitidosEvento, quantidadeEventosItem, resolverPerfilItem } from './scheduleProfiles.ts'

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

/** Avança N dias válidos conforme o perfil; a data inicial não conta. */
export function workdayPermitidos(s: string, n: number, hol: Set<string> | null, diasPermitidos: number[]): string {
  let d = toN(s), left = n
  const permitidos = new Set(diasPermitidos.length ? diasPermitidos : [1, 2, 3, 4, 5])
  while (left > 0) {
    d++
    if (!permitidos.has(dow(d))) continue
    if (hol && hol.has(toS(d))) continue
    left--
  }
  return toS(d)
}

/** WORKDAY do Excel: segunda a sexta, ignorando feriados; a data inicial não conta. */
export function workday(s: string, n: number, hol: Set<string> | null): string {
  return workdayPermitidos(s, n, hol, [1, 2, 3, 4, 5])
}


/** Último dia da fase intensiva de Aprendizagem. O primeiro dia da turma conta como dia 1. */
export function fimFaseIntensivaAprendizagem(inicio: string, curso: Curso, hol: Set<string>): string | null {
  const perfil = resolverPerfilItem({ configuracaoCronograma: undefined }, curso)
  const ap = perfil.aprendizagem
  if (perfil.modelo !== 'aprendizagem' || !ap || !inicio || ap.faseIntensivaDiasUteis <= 0) return null
  return workdayPermitidos(inicio, Math.max(0, ap.faseIntensivaDiasUteis - 1), hol, ap.diasIntensivos)
}

/** Datas de atendimento/web aula de Aprendizagem dentro de uma UC. */
export function datasAtendimentoAprendizagem(inicioTurma: string, J: string, K: string, curso: Curso, hol: Set<string>): string[] {
  const perfil = resolverPerfilItem({ configuracaoCronograma: undefined }, curso)
  const ap = perfil.aprendizagem
  if (perfil.modelo !== 'aprendizagem' || !ap || !inicioTurma || !J || !K) return []
  const fimIntensivo = fimFaseIntensivaAprendizagem(inicioTurma, curso, hol)
  const out: string[] = []
  for (let d = toN(J); d <= toN(K); d++) {
    const ds = toS(d)
    if (hol.has(ds)) continue
    const w = dow(d)
    const permitido = fimIntensivo && ds <= fimIntensivo ? ap.diasIntensivos.includes(w) : ap.diasAtendimentoRegular.includes(w)
    if (permitido) out.push(ds)
  }
  return out
}

export function dataAtendimentoAprendizagemValida(inicioTurma: string, data: string, curso: Curso, hol: Set<string>): boolean {
  if (!data || hol.has(data)) return false
  const perfil = resolverPerfilItem({ configuracaoCronograma: undefined }, curso)
  const ap = perfil.aprendizagem
  if (perfil.modelo !== 'aprendizagem' || !ap || !inicioTurma) return false
  const fimIntensivo = fimFaseIntensivaAprendizagem(inicioTurma, curso, hol)
  const w = dow(toN(data))
  return !!(fimIntensivo && data <= fimIntensivo ? ap.diasIntensivos.includes(w) : ap.diasAtendimentoRegular.includes(w))
}

export interface Calc { H: number; I: number; J: string | null; K: string | null; L: string | null; nenc: number; nsinc: number }
export interface Row { m: Modulo; it: Item; first: boolean; c: Calc }
export interface Result { curso: Curso; rows: Row[]; by: Record<string, Row>; end: string | null; sumUC: number; nUC: number }

/** Feriados que valem para a turma: os gerais e os da unidade dela. */
export const feriadosDaTurma = (t: { unidadeId: string }, feriados: Feriado[]) => feriados.filter(f => !f[2] || f[2] === t.unidadeId)

/**
 * Simula uma redistribuição conservadora entre início e fim.
 * Mantém integralmente a duração pedagógica de cada etapa; nunca comprime horas.
 * Apenas acrescenta folgas entre etapas para atingir uma data posterior ao cálculo base.
 * Não persiste alterações: quem chama deve confirmar e salvar a nova configuração.
 */
export function simularRecalculoPeriodo(
  t: Pick<Turma, 'inicio' | 'unidadeId'>,
  curso: Curso,
  feriados: Feriado[],
  fim: string
): { ok: true; plano: Result } | { ok: false; motivo: string } {
  if (!t.inicio || !/^\\d{4}-\\d{2}-\\d{2}$/.test(fim) || fim < t.inicio)
    return { ok: false, motivo: 'Informe datas válidas de início e término, em ordem cronológica.' }
  const base = compute(t, curso, feriados)
  if (!base.end || !base.rows.length) return { ok: false, motivo: 'O curso não possui etapas calculáveis.' }
  if (fim < base.end) return { ok: false, motivo: `O intervalo é insuficiente: mantendo a carga horária e as regras atuais, o primeiro término possível é ${br(base.end)}.` }
  if (fim === base.end) return { ok: true, plano: base }
  const hol = new Set(feriadosDaTurma(t, feriados).map(f => f[0]))
  const ultimo = base.rows[base.rows.length - 1]
  const dias = resolverPerfilItem(ultimo.it, curso).diasEstudoPermitidos
  const dateValid = (v: string) => !hol.has(v) && (dias.length ? dias : [1, 2, 3, 4, 5]).includes(dow(toN(v)))
  if (!dateValid(fim)) return { ok: false, motivo: 'O término solicitado cai em feriado ou dia não permitido pelo modelo da última etapa.' }
  // A folga deve ser composta de dias permitidos da última etapa, sem inventar carga horária.
  let acrescentar = 0, data = base.end
  while (data < fim && acrescentar <= 3660) {
    data = workdayPermitidos(data, 1, hol, dias)
    acrescentar++
  }
  if (data !== fim) return { ok: false, motivo: 'Não foi possível alinhar o término às regras de calendário do curso.' }
  // Uma única etapa não recebe folga artificial; precisamos preservar a duração fixa da UC.
  if (base.rows.length < 2) return { ok: false, motivo: 'Não é possível alongar uma única etapa sem alterar sua duração ou as regras do curso.' }
  // Aplica a folga antes da última etapa. Esta solução conservadora mantém as UCs anteriores intactas.
  const rows = base.rows.map(r => ({ ...r, c: { ...r.c } }))
  const last = rows[rows.length - 1]
  if (!last.c.J || !last.c.K) return { ok: false, motivo: 'A última etapa não possui datas calculadas.' }
  const inicioDeslocado = workdayPermitidos(last.c.J, acrescentar, hol, dias)
  const fimDeslocado = workdayPermitidos(last.c.K, acrescentar, hol, dias)
  if (fimDeslocado !== fim) return { ok: false, motivo: 'Não foi possível preservar a duração pedagógica da etapa final nesse calendário.' }
  last.c.J = inicioDeslocado
  last.c.K = fimDeslocado
  const by = Object.fromEntries(rows.map(r => [r.it.id, r])) as Record<string, Row>
  return { ok: true, plano: { ...base, rows, by, end: fim } }
}

export function compute(t: Pick<Turma, 'inicio' | 'unidadeId'> & { itens?: Turma['itens'] }, curso: Curso, feriados: Feriado[]): Result {
  const hol = new Set(feriadosDaTurma(t, feriados).map(f => f[0]))
  const rows: Row[] = []
  const by: Record<string, Row> = {}
  let lastMain: Row | null = null, lastUC: Row | null = null, prev: Row | null = null
  ;(curso.modulos || []).forEach(m => (m.itens || []).forEach((it, ix) => {
    const H = (+it.ch || 0) - (+it.pres || 0)
    const I = diasEstudoItem(it, curso)
    const perfil = resolverPerfilItem(it, curso)
    const diasEstudo = perfil.diasEstudoPermitidos
    let J: string | null = null
    if (it.tipo === 'intro' || !rows.length) J = t.inicio || null
    else {
      const ref = it.tipo === 'uc' ? lastMain : it.tipo === 'rec' ? lastUC : prev
      J = ref && ref.c.K ? workdayPermitidos(ref.c.K, 1, hol, diasEstudo) : null
    }
    if (t.itens?.[it.id]?.inicioPlanejado) J = t.itens[it.id].inicioPlanejado || J
    const K = J ? workdayPermitidos(J, I, hol, diasEstudo) : null
    const nenc = it.tipo === 'uc' ? quantidadeEventosItem(it, curso, 'presencial') : it.tipo === 'intro' ? ((+it.pres || 0) > 0 ? 1 : 0) : 0
    const nsinc = it.tipo === 'uc' ? (perfil.modelo === 'aprendizagem' && J && K && t.inicio ? datasAtendimentoAprendizagem(t.inicio, J, K, curso, hol).length : quantidadeEventosItem(it, curso, 'sincrono')) : 0
    const row: Row = { m, it, first: ix === 0, c: { H, I, J, K, L: null, nenc, nsinc } }
    rows.push(row); by[it.id] = row
    if (it.tipo === 'uc' || it.tipo === 'mat' || it.tipo === 'intro' || it.tipo === 'pratica') lastMain = row
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
  rows.forEach(r => { if (r.c.K && (!end || r.c.K > end)) end = r.c.K; if (r.it.tipo === 'uc' || r.it.tipo === 'pratica') { sumUC += +r.it.ch || 0; if (r.it.tipo === 'uc') nUC++ } })
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

export type MomentoInstrucional = Encontro & { tipo: 'presencial' | 'sincrono' }

/** Momentos síncronos de uma UC, independentes da carga presencial. */
export function sincronicos(t: Pick<Turma, 'itens'>, r: Row, curso: Curso): Encontro[] {
  if (r.it.tipo !== 'uc' || r.c.nsinc <= 0) return []
  const st: ItemTurma = t.itens[r.it.id] || {}
  const perfil = resolverPerfilItem(r.it, curso)
  const base = (st.sin || []).slice(0, r.c.nsinc)
  while (base.length < r.c.nsinc) base.push({ d: '', h: perfil.aprendizagem?.horarioWebaula || perfil.sincrono.horario || curso.regras.horario, w: curso.regras.webHora })
  return base
}

/** Todos os momentos instrucionais que precisam de data na grade. */
export function momentos(t: Pick<Turma, 'itens'>, r: Row, curso: Curso): MomentoInstrucional[] {
  return [
    ...encontros(t, r, curso).map(e => ({ ...e, tipo: 'presencial' as const })),
    ...sincronicos(t, r, curso).map(e => ({ ...e, tipo: 'sincrono' as const })),
  ]
}

/**
 * Sugere as datas dos encontros presenciais de uma etapa: sábados dentro do período da etapa
 * (de J a K), fora de feriados e espaçados de forma regular. Se faltarem sábados no período,
 * completa com os seguintes.
 */
export function sugerirEventos(J: string, K: string | null, n: number, hol: Set<string>, diasPermitidos: number[], estrategia: 'sequencial' | 'distribuido' = 'sequencial'): string[] {
  if (n <= 0) return []
  const permitidos = new Set(diasPermitidos.length ? diasPermitidos : [1, 2, 3, 4, 5])
  const ini = toN(J), fim = K ? toN(K) : ini
  const ok = (d: number) => permitidos.has(dow(d)) && !hol.has(toS(d))
  const disponiveis: number[] = []
  for (let d = ini; d <= fim; d++) if (ok(d)) disponiveis.push(d)
  for (let d = fim + 1; disponiveis.length < n && d < fim + 400; d++) if (ok(d)) disponiveis.push(d)
  if (disponiveis.length <= n || estrategia === 'sequencial') return disponiveis.slice(0, n).map(toS)
  const pick = n === 1 ? [disponiveis[0]] : Array.from({ length: n }, (_, i) => disponiveis[Math.round(i * (disponiveis.length - 1) / (n - 1))])
  return pick.filter(x => x !== undefined).map(toS)
}

export function sugerirEncontros(J: string, K: string | null, n: number, hol: Set<string>): string[] {
  return sugerirEventos(J, K, n, hol, [6], 'distribuido')
}

/** Calcula os encontros de todas as etapas a partir do início da turma. `so_vazios` preserva as datas já digitadas. */
export function planejarEncontros(t: Pick<Turma, 'itens' | 'unidadeId'>, G: Result, feriados: Feriado[], soVazios: boolean): Record<string, Encontro[]> {
  const hol = new Set(feriadosDaTurma(t, feriados).map(f => f[0]))
  const out: Record<string, Encontro[]> = {}
  for (const r of G.rows) {
    if (r.it.tipo !== 'uc' || !r.c.J) continue
    const atual = encontros(t, r, G.curso)
    const sug = sugerirEventos(r.c.J, r.c.K, r.c.nenc, hol, diasPermitidosEvento(r.it, G.curso, 'presencial'), 'distribuido')
    const novo = atual.map((e, i) => (soVazios && e.d) ? e : { ...e, d: sug[i] || e.d })
    if (novo.some((e, i) => e.d !== atual[i].d)) out[r.it.id] = novo
  }
  return out
}

/** Calcula os momentos síncronos de todas as UCs, preservando datas preenchidas quando solicitado. */
export function planejarSincronicos(t: Pick<Turma, 'itens' | 'unidadeId' | 'inicio'>, G: Result, feriados: Feriado[], soVazios: boolean): Record<string, Encontro[]> {
  const hol = new Set(feriadosDaTurma(t, feriados).map(f => f[0]))
  const out: Record<string, Encontro[]> = {}
  for (const r of G.rows) {
    if (r.it.tipo !== 'uc' || !r.c.J || r.c.nsinc <= 0) continue
    const atual = sincronicos(t, r, G.curso)
    const perfil = resolverPerfilItem(r.it, G.curso)
    const sug = perfil.modelo === 'aprendizagem' && r.c.K
      ? datasAtendimentoAprendizagem(t.inicio || r.c.J, r.c.J, r.c.K, G.curso, hol)
      : sugerirEventos(r.c.J, r.c.K, r.c.nsinc, hol, diasPermitidosEvento(r.it, G.curso, 'sincrono'))
    const novo = atual.map((e, i) => (soVazios && e.d) ? e : { ...e, d: sug[i] || e.d })
    if (novo.some((e, i) => e.d !== atual[i].d)) out[r.it.id] = novo
  }
  return out
}

/** `ref` aponta o encontro com problema (para pintar a data de vermelho e corrigir); `dt` é o trecho do texto que vai em vermelho. */
export type Aviso = { nivel: 'ok' | 'warn' | 'bad'; area: string; texto: string; ref?: { item: string; ix: number; tipo: 'presencial' | 'sincrono' }; dt?: string; campo?: 'inicio' | 'fim' }
export function verificar(t: Turma, G: Result, todos: Feriado[]): Aviso[] {
  const out: Aviso[] = []
  const feriados = feriadosDaTurma(t, todos)
  const hol = new Set(feriados.map(f => f[0]))
  if (!t.inicio) out.push({ nivel: 'bad', area: 'Turma', texto: 'Informe a data de início da turma.', campo: 'inicio' })
  if (G.sumUC === +G.curso.chTotal) out.push({ nivel: 'ok', area: 'Carga horária', texto: `${G.sumUC} h nas unidades curriculares, igual à carga horária total do curso.` })
  else out.push({ nivel: 'bad', area: 'Carga horária', texto: `As unidades curriculares somam ${G.sumUC} h, mas o curso tem ${G.curso.chTotal} h. Recuperação, Matrícula e o curso introdutório não entram na soma; prática profissional entra quando possui carga horária.` })
  const last = feriados.reduce((m, h) => (h[0] > m ? h[0] : m), '0000')
  if (G.end && G.end > last) out.push({ nivel: 'bad', area: 'Feriados', texto: `O cronograma termina em ${fmtShort(G.end)}, depois do último feriado cadastrado (${fmtShort(last)}). Cadastre os feriados desse período para os prazos ficarem corretos.`, dt: fmtShort(G.end), campo: 'fim' })
  G.rows.forEach(r => {
    if (r.it.tipo !== 'uc') return
    let prev = ''
    const diasPresenciais = diasPermitidosEvento(r.it, G.curso, 'presencial')
    encontros(t, r, G.curso).forEach((e, ix) => {
      const n = `${ix + 1}º encontro presencial de ${r.it.nome}`
      const ref = { item: r.it.id, ix, tipo: 'presencial' as const }
      if (!e.d) { out.push({ nivel: 'warn', area: 'Encontros', texto: `${n} está sem data.`, ref, dt: 'sem data' }); return }
      const dn = toN(e.d), w = dow(dn), dt = fmtShort(e.d)
      if (!diasPresenciais.includes(w)) out.push({ nivel: 'warn', area: 'Encontros', texto: `${n} cai em ${wdName(e.d)} (${dt}), fora dos dias permitidos (${diasPresenciais.map(d => WD[d]).join(', ')}).`, ref, dt })
      if (hol.has(e.d)) out.push({ nivel: 'warn', area: 'Encontros', texto: `${n} cai em um dia cadastrado como feriado ou férias (${dt}).`, ref, dt })
      if (r.c.J && r.c.K && (e.d < r.c.J || e.d > r.c.K)) out.push({ nivel: 'warn', area: 'Encontros', texto: `${n} (${dt}) fica fora do período da UC, de ${fmtShort(r.c.J)} a ${fmtShort(r.c.K)}.`, ref, dt })
      if (prev && e.d <= prev) out.push({ nivel: 'warn', area: 'Encontros', texto: `${n} (${dt}) precisa ser depois do encontro anterior.`, ref, dt })
      prev = e.d
    })
    prev = ''
    const diasSincronos = diasPermitidosEvento(r.it, G.curso, 'sincrono')
    sincronicos(t, r, G.curso).forEach((e, ix) => {
      const n = `${ix + 1}º momento síncrono de ${r.it.nome}`
      const ref = { item: r.it.id, ix, tipo: 'sincrono' as const }
      if (!e.d) { out.push({ nivel: 'warn', area: 'Momentos síncronos', texto: `${n} está sem data.`, ref, dt: 'sem data' }); return }
      const w = dow(toN(e.d)), dt = fmtShort(e.d)
      if (G.curso.modeloCronograma === 'aprendizagem') {
        if (!dataAtendimentoAprendizagemValida(t.inicio, e.d, G.curso, hol)) out.push({ nivel: 'warn', area: 'Momentos síncronos', texto: `${n} cai fora da regra de atendimento da Aprendizagem (${dt}).`, ref, dt })
      } else if (!diasSincronos.includes(w)) out.push({ nivel: 'warn', area: 'Momentos síncronos', texto: `${n} cai em ${wdName(e.d)} (${dt}), fora dos dias permitidos (${diasSincronos.map(d => WD[d]).join(', ')}).`, ref, dt })
      if (hol.has(e.d)) out.push({ nivel: 'warn', area: 'Momentos síncronos', texto: `${n} cai em um dia cadastrado como feriado ou férias (${dt}).`, ref, dt })
      if (r.c.J && r.c.K && (e.d < r.c.J || e.d > r.c.K)) out.push({ nivel: 'warn', area: 'Momentos síncronos', texto: `${n} (${dt}) fica fora do período da UC, de ${fmtShort(r.c.J)} a ${fmtShort(r.c.K)}.`, ref, dt })
      if (prev && e.d <= prev) out.push({ nivel: 'warn', area: 'Momentos síncronos', texto: `${n} (${dt}) precisa ser depois do momento anterior.`, ref, dt })
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

/** Chaves "tipo:item:índice" dos momentos com data a corrigir. */
export const encontrosRuins = (avisos: Aviso[]) => new Set(avisos.filter(a => a.ref).map(a => `${a.ref!.tipo}:${a.ref!.item}:${a.ref!.ix}`))

/**
 * Corrige só os encontros com problema: troca a data pelo dia permitido livre mais próximo, dentro do período da etapa,
 * fora de feriados e depois do encontro anterior. As datas que já estão certas não mudam.
 * `so` limita a correção a um encontro ("item:índice").
 */
export function corrigirEncontros(t: Pick<Turma, 'itens' | 'unidadeId'>, G: Result, feriados: Feriado[], ruins: Set<string>, so?: string): Record<string, Encontro[]> {
  const hol = new Set(feriadosDaTurma(t, feriados).map(f => f[0]))
  const out: Record<string, Encontro[]> = {}
  for (const r of G.rows) {
    if (r.it.tipo !== 'uc' || !r.c.J) continue
    const atual = encontros(t, r, G.curso)
    if (!atual.some((_, i) => ruins.has(`presencial:${r.it.id}:${i}`) && (!so || so === `presencial:${r.it.id}:${i}`))) continue
    const diasPermitidos = diasPermitidosEvento(r.it, G.curso, 'presencial')
    const permitidos = new Set(diasPermitidos.length ? diasPermitidos : [1, 2, 3, 4, 5])
    const sug = sugerirEventos(r.c.J, r.c.K, r.c.nenc, hol, diasPermitidos, 'distribuido')
    const candidatos: number[] = []
    for (let d = toN(r.c.J); d <= toN(r.c.K || r.c.J); d++) if (permitidos.has(dow(d)) && !hol.has(toS(d))) candidatos.push(d)
    const novo = atual.map(e => ({ ...e }))
    let prev = ''
    novo.forEach((e, i) => {
      const k = `presencial:${r.it.id}:${i}`
      if (ruins.has(k) && (!so || so === k)) {
        const usadas = new Set(novo.filter((_, j) => j !== i).map(x => x.d))
        const livres = candidatos.filter(d => toS(d) > prev && !usadas.has(toS(d)))
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
/** O curso tem encontros presenciais ou momentos síncronos configurados? */
export const cursoTemMomentos = (curso: Curso) => curso.modeloCronograma === 'aprendizagem' || (curso.modulos || []).some(m => (m.itens || []).some(it => it.tipo === 'uc' && (quantidadeEventosItem(it, curso, 'presencial') > 0 || quantidadeEventosItem(it, curso, 'sincrono') > 0)))
