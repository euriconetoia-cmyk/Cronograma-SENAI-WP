import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { ApiError, type AcaoBody, type Api } from './api'
import { podeEditar } from './rules'
import type { Aviso, AvisosResp, Boot, Catalogo, Dados, Me, Turma } from './types'

export type Page = 'inicio' | 'cronograma' | 'turmas' | 'cursos' | 'equipe' | 'acessos' | 'unidades' | 'feriados' | 'integracoes' | 'backup'
export const PAGES_EQUIPE: Page[] = ['inicio', 'cronograma', 'turmas', 'cursos', 'equipe', 'acessos', 'unidades', 'feriados', 'integracoes', 'backup']
/** Páginas que ficam dentro do menu Configurações. */
export const CONFIG_PAGES: Page[] = ['equipe', 'acessos', 'unidades', 'feriados', 'integracoes', 'backup']
export const PAGES_UNIDADE: Page[] = ['inicio', 'cronograma', 'turmas']
export type Salvo = 'ok' | 'sujo' | 'salvando' | 'erro'

interface Ctx {
  api: Api
  me: Me
  d: Dados
  update: (fn: (d: Dados) => void) => void
  page: Page
  pages: Page[]
  go: (p: Page) => void
  turmaId: string
  setTurmaId: (id: string) => void
  /** true = o cronograma de uma turma está aberto; false = mostra a lista de cronogramas. */
  cronAberto: boolean
  setCronAberto: (v: boolean) => void
  cursoId: string
  setCursoId: (id: string) => void
  salvo: Salvo
  pendentes: string[]
  lock: (t: Turma | undefined, tipo: 'ajuste' | 'equipe') => boolean
  flush: (id?: string) => Promise<void>
  salvarAjustes: (id: string, motivo: string) => Promise<Turma>
  descartar: (id: string) => Promise<void>
  acao: (id: string, body: Omit<AcaoBody, 'rev'>) => Promise<Turma>
  criarTurma: (t: Partial<Turma> & { id: string }) => Promise<Turma>
  excluirTurma: (id: string) => Promise<void>
  recarregar: () => Promise<void>
  conflito: string | null
  fecharConflito: () => void
  catalogoRev: number
  importar: (c: { catalogo: Catalogo; turmas: Turma[] }, confirmacao: string) => Promise<{ turmas: number; puladas: number }>
  /** Avisos do sino e pedidos das unidades (atualizam sozinhos a cada minuto). */
  avisos: Aviso[]
  naoLidos: number
  pedidosAbertos: number
  recarregarAvisos: () => Promise<void>
  lerAvisos: (b: { ids?: number[]; turma?: string; todos?: boolean }) => Promise<void>
  atenderPedido: (id: number) => Promise<void>
}
const C = createContext<Ctx | null>(null)
export const useStore = () => { const c = useContext(C); if (!c) throw new Error('Store ausente'); return c }

const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o))
const cat = (d: Dados): Catalogo => ({ cursos: d.cursos, pessoas: d.pessoas, feriados: d.feriados, unidades: d.unidades })
const META = ['rev', 'status', 'versao', 'prazo', 'vigente'] as const
const pageFromHash = (ok: Page[], fallback: Page): Page => { const h = window.location.hash.replace('#', '').split('?')[0] as Page; return ok.includes(h) ? h : fallback }

export function StoreProvider({ api, view, turmaInicial, children }: { api: Api; view?: string; turmaInicial?: string; children: ReactNode }) {
  const [boot, setBoot] = useState<Boot | null>(null)
  const [erroBoot, setErroBoot] = useState('')
  const [bootId, setBootId] = useState(0)
  const carregar = useCallback(async () => {
    setErroBoot('')
    try { const b = await api.boot(); setBoot(b); setBootId(x => x + 1) } catch (e) { setBoot(null); setErroBoot(e instanceof Error ? e.message : 'Não foi possível carregar.') }
  }, [api])
  useEffect(() => { void carregar() }, [carregar])

  if (erroBoot) return (
    <div className="mx-auto max-w-lg p-8">
      <h2 className="text-lg font-semibold">Não foi possível abrir os cronogramas</h2>
      <p className="mt-1 text-sm text-muted-foreground">{erroBoot}</p>
      <button className="mt-4 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground" onClick={() => void carregar()}>Tentar de novo</button>
    </div>
  )
  if (!boot) return (
    <div role="status" aria-label="Carregando cronogramas" className="min-h-screen">
      <div className="h-14 border-b bg-card" />
      <div className="mx-auto flex max-w-[1500px] flex-col gap-4 px-4 pt-6">
        <div className="ce-esq h-8 w-48 rounded-md" /><div className="ce-esq h-32 rounded-2xl" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">{[0, 1, 2, 3, 4].map(i => <div key={i} className="ce-esq h-20 rounded-xl" />)}</div>
        <div className="ce-esq h-48 rounded-xl" /><span className="sr-only">Carregando cronogramas…</span>
      </div>
    </div>
  )
  return <Inner key={bootId} api={api} boot={boot} view={view} turmaInicial={turmaInicial} recarregarTudo={carregar}>{children}</Inner>
}

function Inner({ api, boot, view, turmaInicial, recarregarTudo, children }: { api: Api; boot: Boot; view?: string; turmaInicial?: string; recarregarTudo: () => Promise<void>; children: ReactNode }) {
  const me = boot.me
  const pages = me.perfil === 'equipe' ? PAGES_EQUIPE : PAGES_UNIDADE
  const [d, setD] = useState<Dados>(() => ({ ...clone(boot.catalogo), turmas: clone(boot.turmas) }))
  const dRef = useRef(d)
  const [crev, setCrev] = useState(boot.crev)
  const crevRef = useRef(boot.crev)
  const [page, setPage] = useState<Page>(() => pageFromHash(pages, pages.includes(view as Page) ? (view as Page) : 'inicio'))
  const [turmaId, setTurmaIdRaw] = useState(() => (turmaInicial && boot.turmas.some(t => t.id === turmaInicial) ? turmaInicial : boot.turmas[0]?.id ?? ''))
  const [cronAberto, setCronAberto] = useState(() => !!turmaInicial && boot.turmas.some(t => t.id === turmaInicial))
  // Escolher uma turma de propósito (lista, sino, Início) abre o cronograma dela.
  const setTurmaId = useCallback((id: string) => { setTurmaIdRaw(id); setCronAberto(true) }, [])
  const [cursoId, setCursoId] = useState(() => boot.catalogo.cursos[0]?.id ?? '')
  const [salvo, setSalvo] = useState<Salvo>('ok')
  const [pendentes, setPendentes] = useState<string[]>([])
  const [conflito, setConflito] = useState<string | null>(null)

  const [av, setAv] = useState<AvisosResp>({ avisos: [], naoLidos: 0, pedidosAbertos: 0 })
  const recarregarAvisos = useCallback(async () => { try { setAv(await api.avisos()) } catch { /* sem rede: mantém o que já tem */ } }, [api])
  useEffect(() => {
    void recarregarAvisos()
    const iv = setInterval(() => { if (!document.hidden) void recarregarAvisos() }, 60000)
    const vis = () => { if (!document.hidden) void recarregarAvisos() }
    document.addEventListener('visibilitychange', vis)
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', vis) }
  }, [recarregarAvisos])
  const lerAvisos = useCallback(async (b: { ids?: number[]; turma?: string; todos?: boolean }) => {
    // Atualiza na hora; o servidor confirma na próxima leitura.
    setAv(a => { const marca = (x: Aviso) => x.meu && !x.lido && (b.todos || b.ids?.includes(x.id) || (!!b.turma && x.turmaId === b.turma)); const lista = a.avisos.map(x => (marca(x) ? { ...x, lido: true } : x)); return { ...a, avisos: lista, naoLidos: lista.filter(x => x.meu && !x.lido).length } })
    try { await api.avisosLidos(b) } catch { void recarregarAvisos() }
  }, [api, recarregarAvisos])
  const atenderPedido = useCallback(async (id: number) => { setAv(await api.atenderPedido(id)) }, [api])

  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const catTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sujos = useRef<Set<string>>(new Set())
  const catSujo = useRef(false)
  const voo = useRef<Promise<unknown>>(Promise.resolve())
  const emVoo = useRef(0)
  const setD2 = (n: Dados) => { dRef.current = n; setD(n) }

  const atualizarEstado = useCallback((erro = false) => {
    setPendentes([...sujos.current])
    setSalvo(erro ? 'erro' : emVoo.current > 0 ? 'salvando' : sujos.current.size > 0 || catSujo.current ? 'sujo' : 'ok')
  }, [])

  /** Executa gravações em fila, uma de cada vez, para a revisão (rev) estar sempre em dia. */
  const enfileirar = useCallback(<T,>(fn: () => Promise<T>): Promise<T> => {
    emVoo.current++; atualizarEstado()
    const p = voo.current.then(fn, fn).finally(() => { emVoo.current--; atualizarEstado() })
    voo.current = p.catch(() => undefined)
    return p
  }, [atualizarEstado])

  const aplicarMeta = (r: Turma) => {
    const n = clone(dRef.current)
    const t = n.turmas.find(x => x.id === r.id)
    if (t) META.forEach(k => { (t as unknown as Record<string, unknown>)[k] = r[k] })
    setD2(n)
  }
  const trocarTurma = (r: Turma) => { const n = clone(dRef.current); const i = n.turmas.findIndex(x => x.id === r.id); if (i >= 0) n.turmas[i] = r; else n.turmas.push(r); setD2(n) }

  const falhou = (e: unknown, id?: string) => {
    if (e instanceof ApiError && e.status === 409) {
      if (e.turma) { sujos.current.delete(id || ''); trocarTurma(e.turma) }
      setConflito(e.turma ? 'Esta turma foi alterada por outra pessoa enquanto você editava. Mostramos a versão mais recente; suas últimas mudanças não foram salvas.' : 'O cadastro foi alterado por outra pessoa. Recarregue para continuar.')
    } else toast(e instanceof Error ? e.message : 'Não foi possível salvar.')
    atualizarEstado(true)
  }

  const salvarTurma = useCallback((id: string) => enfileirar(async () => {
    if (!sujos.current.has(id)) return
    const t = dRef.current.turmas.find(x => x.id === id)
    if (!t) return
    sujos.current.delete(id)
    try { aplicarMeta(await api.salvar(id, t, t.rev)) } catch (e) { sujos.current.add(id); falhou(e, id) }
  }), [api, enfileirar]) // eslint-disable-line react-hooks/exhaustive-deps

  const salvarCatalogo = useCallback(() => enfileirar(async () => {
    if (!catSujo.current) return
    catSujo.current = false
    try { const r = await api.saveCatalogo(cat(dRef.current), crevRef.current); crevRef.current = r.rev; setCrev(r.rev) } catch (e) { catSujo.current = true; falhou(e) }
  }), [api, enfileirar]) // eslint-disable-line react-hooks/exhaustive-deps

  const update = useCallback((fn: (d: Dados) => void) => {
    const prev = dRef.current
    const n = clone(prev)
    fn(n)
    n.turmas = prev.turmas.map(o => n.turmas.find(x => x.id === o.id) ?? o) // turmas entram e saem só pelo servidor
    const mudou: string[] = []
    n.turmas = n.turmas.map(t => {
      const o = prev.turmas.find(x => x.id === t.id)!
      if (JSON.stringify(o) === JSON.stringify(t)) return o
      if (!podeEditar(o.status, me.perfil)) { toast('Este cronograma está bloqueado para alterações.'); return o }
      mudou.push(t.id); return t
    })
    const catMudou = me.perfil === 'equipe' && JSON.stringify(cat(prev)) !== JSON.stringify(cat(n))
    if (!catMudou) { n.cursos = prev.cursos; n.pessoas = prev.pessoas; n.feriados = prev.feriados; n.unidades = prev.unidades }
    if (!mudou.length && !catMudou) return
    setD2(n)
    for (const id of mudou) {
      sujos.current.add(id)
      if (me.perfil === 'equipe') { clearTimeout(timers.current[id]); timers.current[id] = setTimeout(() => void salvarTurma(id), 800) }
    }
    if (catMudou) { catSujo.current = true; if (catTimer.current) clearTimeout(catTimer.current); catTimer.current = setTimeout(() => void salvarCatalogo(), 800) }
    atualizarEstado()
  }, [me.perfil, salvarTurma, salvarCatalogo, atualizarEstado])

  const flush = useCallback(async (id?: string) => {
    for (const k of Object.keys(timers.current)) if (!id || k === id) clearTimeout(timers.current[k])
    if (catTimer.current) clearTimeout(catTimer.current)
    const ids = id ? [id] : [...sujos.current]
    for (const i of ids) await salvarTurma(i)
    await salvarCatalogo()
  }, [salvarTurma, salvarCatalogo])

  const salvarAjustes = useCallback(async (id: string, motivo: string) => {
    const t = dRef.current.turmas.find(x => x.id === id)!
    const r = await enfileirar(() => api.salvar(id, t, t.rev, motivo))
    sujos.current.delete(id); trocarTurma(r); atualizarEstado()
    return r
  }, [api, enfileirar, atualizarEstado])

  const descartar = useCallback(async (id: string) => {
    sujos.current.delete(id); clearTimeout(timers.current[id])
    const b = await api.boot(); const r = b.turmas.find(x => x.id === id); if (r) trocarTurma(r)
    atualizarEstado()
  }, [api, atualizarEstado])

  const acao = useCallback(async (id: string, body: Omit<AcaoBody, 'rev'>) => {
    if (me.perfil === 'equipe') await flush(id)
    else if (sujos.current.has(id)) throw new ApiError(0, 'sujo', 'Salve ou descarte seus ajustes antes de continuar.')
    const t = dRef.current.turmas.find(x => x.id === id)!
    try {
      const r = await enfileirar(() => api.acao(id, { ...body, rev: t.rev }))
      trocarTurma(r); void recarregarAvisos()
      return r
    } catch (e) { if (e instanceof ApiError && e.status === 409) falhou(e, id); throw e }
  }, [api, enfileirar, flush, me.perfil, recarregarAvisos]) // eslint-disable-line react-hooks/exhaustive-deps

  const criarTurma = useCallback(async (t: Partial<Turma> & { id: string }) => { const r = await api.criar(t); trocarTurma(r); setTurmaIdRaw(r.id); return r }, [api])
  const excluirTurma = useCallback(async (id: string) => {
    sujos.current.delete(id); clearTimeout(timers.current[id])
    await api.excluir(id)
    const n = clone(dRef.current); n.turmas = n.turmas.filter(x => x.id !== id); setD2(n); atualizarEstado()
  }, [api, atualizarEstado])
  const importar = useCallback(async (c: { catalogo: Catalogo; turmas: Turma[] }, confirmacao: string) => {
    await flush()
    const r = await api.importar(c, crevRef.current, confirmacao)
    await recarregarTudo()
    return r
  }, [api, flush, recarregarTudo])

  useEffect(() => { const f = () => setPage(pageFromHash(pages, 'inicio')); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f) }, [pages])
  useEffect(() => { if (!d.turmas.some(t => t.id === turmaId)) setTurmaIdRaw(d.turmas[0]?.id ?? '') }, [d.turmas, turmaId])
  useEffect(() => { if (!d.cursos.some(c => c.id === cursoId)) setCursoId(d.cursos[0]?.id ?? '') }, [d.cursos, cursoId])
  useEffect(() => {
    const f = (e: BeforeUnloadEvent) => { if (sujos.current.size || catSujo.current || emVoo.current) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', f); return () => window.removeEventListener('beforeunload', f)
  }, [])

  const go = useCallback((p: Page) => { window.location.hash = p; setPage(p) }, [])
  const lock = useCallback((t: Turma | undefined, tipo: 'ajuste' | 'equipe') => {
    if (!t || !podeEditar(t.status, me.perfil)) return true
    return me.perfil === 'equipe' ? false : tipo !== 'ajuste'
  }, [me.perfil])

  const v = useMemo<Ctx>(() => ({
    api, me, d, update, page, pages, go, turmaId, setTurmaId, cronAberto, setCronAberto, cursoId, setCursoId, salvo, pendentes, lock, flush, salvarAjustes, descartar, acao, criarTurma, excluirTurma,
    recarregar: recarregarTudo, avisos: av.avisos, naoLidos: av.naoLidos, pedidosAbertos: av.pedidosAbertos, recarregarAvisos, lerAvisos, atenderPedido, conflito, fecharConflito: () => setConflito(null), catalogoRev: crev, importar,
  }), [api, me, d, update, page, pages, go, turmaId, setTurmaId, cronAberto, cursoId, salvo, pendentes, lock, flush, salvarAjustes, descartar, acao, criarTurma, excluirTurma, recarregarTudo, conflito, crev, importar, av, recarregarAvisos, lerAvisos, atenderPedido])
  return <C.Provider value={v}>{children}</C.Provider>
}
