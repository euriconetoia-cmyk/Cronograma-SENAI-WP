import { useMemo, useState } from 'react'
import { ArrowRight, BellRing, CalendarClock, Plus, Search, X } from 'lucide-react'
import { Empty } from '@/components/Fields'
import { StatusBadge } from '@/components/Status'
import { compute, fmtShort } from '@/lib/schedule'
import { pedidoAberto } from '@/lib/avisos'
import { useStore } from '@/lib/store'
import { T } from '@/lib/texts'
import type { Status, Turma } from '@/lib/types'

const KEY = 'ce_ultima_turma'
export const lembrarTurma = (id: string) => { try { localStorage.setItem(KEY, id) } catch { /* sem armazenamento: tudo bem */ } }
const lembrada = () => { try { return localStorage.getItem(KEY) || '' } catch { return '' } }

const BARRA: Record<Status, string> = { solicitado: 'border-l-accent-foreground/60', elaboracao: 'border-l-muted-foreground/60', validacao: 'border-l-warn', validado: 'border-l-ok', arquivado: 'border-l-muted-foreground/30' }
const ORDEM_EQ: Status[] = ['solicitado', 'validacao', 'elaboracao', 'validado', 'arquivado']
const ORDEM_UN: Status[] = ['validacao', 'solicitado', 'elaboracao', 'validado', 'arquivado']
const TITULO: Record<Status, string> = { solicitado: 'Solicitações novas', validacao: 'Aguardando validação', elaboracao: 'Em elaboração', validado: 'Validados', arquivado: 'Arquivados' }
const br = (s: string) => s.split('-').reverse().join('/')
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const hoje = () => new Date().toISOString().slice(0, 10)

/** Lista de todos os cronogramas: o ponto de partida para achar e abrir uma turma. */
export function CronogramaLista() {
  const { d, me, setTurmaId, go, avisos } = useStore()
  const equipe = me.perfil === 'equipe'
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<Status | 'todos' | 'atencao'>('todos')
  const [unidade, setUnidade] = useState('')
  const nomeUn = (id: string) => d.unidades.find(u => u.id === id)?.nome || '—'
  const nomeCurso = (t: Turma) => d.cursos.find(c => c.id === t.cursoId)?.nome || (t.cursoSolicitado ? `${t.cursoSolicitado} (curso a cadastrar)` : 'Sem curso')

  /** Pede a atenção de quem está olhando: pedido aberto (Unidigit@l), mensagem nova (unidade), prazo vencido, solicitação nova ou validação. */
  const atencao = (t: Turma) => {
    if (equipe) return avisos.some(a => a.turmaId === t.id && pedidoAberto(a)) || t.status === 'solicitado' || (t.status === 'validacao' && !!t.prazo && t.prazo < hoje())
    return (t.status === 'validacao' && me.validador) || avisos.some(a => a.turmaId === t.id && a.meu && !a.lido && a.tipo === 'mensagem')
  }
  const pend = (t: Turma) => avisos.filter(a => a.turmaId === t.id && (equipe ? pedidoAberto(a) : a.meu && !a.lido && a.tipo === 'mensagem')).length

  const termino = useMemo(() => {
    const m = new Map<string, string>()
    for (const t of d.turmas) {
      const c = d.cursos.find(x => x.id === t.cursoId)
      try { const g = c && !c.resumo ? compute(t, c, d.feriados) : null; m.set(t.id, t.fimManual ? br(t.fimManual) : g?.end ? fmtShort(g.end) : '') } catch { m.set(t.id, '') }
    }
    return m
  }, [d.turmas, d.cursos, d.feriados])

  const q = norm(busca.trim())
  const visiveis = d.turmas.filter(t => {
    if (filtro === 'atencao' ? !atencao(t) : filtro !== 'todos' ? t.status !== filtro : t.status === 'arquivado') return false
    if (unidade && t.unidadeId !== unidade) return false
    return !q || norm(`${t.nome} ${nomeCurso(t)} ${nomeUn(t.unidadeId)}`).includes(q)
  })
  const ordem = equipe ? ORDEM_EQ : ORDEM_UN
  const grupos = ordem.map(s => ({ s, itens: visiveis.filter(t => t.status === s).sort((a, b) => Number(atencao(b)) - Number(atencao(a)) || (a.inicio || '9').localeCompare(b.inicio || '9')) })).filter(g => g.itens.length)
  const nAtencao = d.turmas.filter(atencao).length
  const cont = (s: Status) => d.turmas.filter(t => t.status === s).length
  const ultima = d.turmas.find(t => t.id === lembrada())
  const abrir = (t: Turma) => { lembrarTurma(t.id); setTurmaId(t.id) }
  const unidadesVis = d.unidades.filter(u => d.turmas.some(t => t.unidadeId === u.id))

  const chip = (ativo: boolean) => `inline-flex min-h-[40px] items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-primary ${ativo ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-foreground hover:border-primary/50 hover:bg-secondary'}`

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Cronogramas</h1>
          <p className="text-sm text-muted-foreground">Escolha uma turma para abrir o cronograma dela. {d.turmas.length} {d.turmas.length === 1 ? 'turma' : 'turmas'} no total.</p>
        </div>
        {equipe && <button type="button" onClick={() => go('turmas')} className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border bg-card px-3.5 text-sm font-semibold hover:bg-secondary"><Plus size={15} />Cadastrar turma</button>}
      </div>

      {ultima && !q && filtro === 'todos' && (
        <button type="button" onClick={() => abrir(ultima)} className="ce-sobe group flex flex-wrap items-center gap-3 rounded-2xl bg-gradient-to-br from-[#0a4ba0] to-[#0077f2] p-4 text-left text-white shadow-md outline-none transition hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-primary">
          <CalendarClock size={26} className="shrink-0 opacity-90" />
          <span className="min-w-0 flex-1"><span className="block text-xs font-semibold uppercase tracking-[.1em] opacity-90">Continuar de onde você parou</span>
            <span className="block truncate font-heading text-lg font-semibold">{ultima.nome || 'Turma sem nome'}</span>
            <span className="block truncate text-sm opacity-90">{nomeCurso(ultima)} · {nomeUn(ultima.unidadeId)}</span></span>
          <span className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-white px-4 text-sm font-bold text-[#0a4ba0] transition-transform group-hover:translate-x-0.5">Abrir<ArrowRight size={16} /></span>
        </button>
      )}

      <div className="flex flex-col gap-3 rounded-xl border bg-card p-3">
        <div className="flex flex-wrap gap-2">
          <label className="relative min-w-[220px] flex-1">
            <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="search" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por turma, curso ou unidade" aria-label="Buscar cronograma" className="field-input !min-h-[44px] !pl-10" />
            {busca && <button type="button" onClick={() => setBusca('')} aria-label="Limpar busca" className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-secondary"><X size={15} /></button>}
          </label>
          {unidadesVis.length > 1 && (
            <select value={unidade} onChange={e => setUnidade(e.target.value)} aria-label="Filtrar por unidade" className="field-input !min-h-[44px] w-auto min-w-[180px]">
              <option value="">Todas as unidades</option>
              {unidadesVis.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-0.5 ce-menu-rolagem" role="group" aria-label="Filtrar por situação">
          <button type="button" className={chip(filtro === 'todos')} aria-pressed={filtro === 'todos'} onClick={() => setFiltro('todos')}>Todos</button>
          <button type="button" className={chip(filtro === 'atencao')} aria-pressed={filtro === 'atencao'} onClick={() => setFiltro('atencao')}><BellRing size={14} />Precisa de você<span className="mono rounded-full bg-warn px-1.5 text-[11px] leading-[18px] text-card">{nAtencao}</span></button>
          {ordem.filter(s => s !== 'arquivado' || cont(s) > 0).map(s => <button key={s} type="button" className={chip(filtro === s)} aria-pressed={filtro === s} onClick={() => setFiltro(s)}>{T.status[s]}<span className={`mono text-xs ${filtro === s ? 'opacity-90' : 'text-muted-foreground'}`}>{cont(s)}</span></button>)}
        </div>
      </div>

      {grupos.length === 0 && (
        d.turmas.length === 0
          ? <Empty titulo={T.cron.semTurma.titulo} texto={T.cron.semTurma.texto} acao={T.cron.semTurma.acao} onAcao={() => go('turmas')} />
          : <div className="rounded-xl border border-dashed bg-card px-4 py-12 text-center text-sm text-muted-foreground"><p className="font-semibold text-foreground">Nenhum cronograma encontrado</p><p className="mt-1">Tente outra palavra ou limpe os filtros.</p><button type="button" onClick={() => { setBusca(''); setFiltro('todos'); setUnidade('') }} className="mt-3 rounded-lg border bg-card px-3.5 py-2 font-semibold text-foreground hover:bg-secondary">Limpar filtros</button></div>
      )}

      {grupos.map(g => (
        <section key={g.s} aria-label={TITULO[g.s]}>
          <h2 className="mb-2 flex items-center gap-2 font-heading text-sm font-semibold uppercase tracking-[.08em] text-muted-foreground">{TITULO[g.s]}<span className="mono rounded-full bg-secondary px-2 text-xs text-foreground">{g.itens.length}</span></h2>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {g.itens.map(t => {
              const aten = atencao(t), n = pend(t), fim = termino.get(t.id)
              return (
                <li key={t.id} className="min-w-0">
                  <button type="button" onClick={() => abrir(t)} aria-label={`Abrir cronograma de ${t.nome || 'turma sem nome'}, ${nomeUn(t.unidadeId)}, ${T.status[t.status]}`}
                    className={`ce-card group flex h-full w-full min-w-0 flex-col gap-2 rounded-xl border border-l-[5px] bg-card p-4 text-left outline-none transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary ${BARRA[t.status]} ${aten ? 'ring-1 ring-warn/50' : ''}`}>
                    <span className="flex items-start justify-between gap-2">
                      <span className="min-w-0 flex-1"><span className="block truncate font-heading text-base font-semibold leading-snug">{t.nome || 'Turma sem nome'}</span>
                        <span className="block truncate text-sm text-muted-foreground">{nomeCurso(t)}</span></span>
                      <span className="flex shrink-0 flex-col items-end gap-1">{n > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-destructive px-1.5 py-0.5 text-[11px] font-bold text-destructive-foreground" title={equipe ? 'Pedido da unidade em aberto' : 'Mensagem nova da Unidigit@l'}><BellRing size={11} />{n}</span>}<StatusBadge status={t.status} versao={t.versao} /></span>
                    </span>
                    <span className="text-sm">{nomeUn(t.unidadeId)}</span>
                    <span className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t pt-2 text-xs text-muted-foreground">
                      <span className="mono">{t.inicio ? br(t.inicio) : 'sem início'}{fim ? ` → ${fim}` : ''}</span>
                      {t.status === 'validacao' && t.prazo ? <span className={t.prazo < hoje() ? 'font-semibold text-destructive' : 'font-semibold text-warn'}>prazo {br(t.prazo)}</span> : <span />}
                      <span className="inline-flex items-center gap-1 font-semibold text-primary opacity-80 transition group-hover:translate-x-0.5 group-hover:opacity-100">Abrir<ArrowRight size={13} /></span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
