import { useEffect, useMemo, useState } from 'react'
import { PedidosInicio } from '@/components/PedidosInicio'
import { AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react'
import { StatusBadge } from '@/components/Status'
import { COR_STATUS } from '@/components/FaixaTurma'
import { quando } from '@/lib/format'
import { todayStr, toN } from '@/lib/schedule'
import { useStore } from '@/lib/store'
import { T } from '@/lib/texts'
import type { Atividade, Status, Turma } from '@/lib/types'

const ORDEM: Status[] = ['solicitado', 'elaboracao', 'validacao', 'validado', 'arquivado']
const dias = (de: string, ate: string) => toN(ate) - toN(de)
const br = (s: string) => s.split('-').reverse().join('/')

/** Página inicial: o retrato dos cronogramas. Cada número e cada linha leva à lista ou ao cronograma. */
export function InicioPage() {
  const { d, me, api, go, setTurmaId } = useStore()
  const equipe = me.perfil === 'equipe'
  const hoje = todayStr()
  const [ativ, setAtiv] = useState<Atividade[] | null>(null)
  useEffect(() => { let vivo = true; api.atividade().then(r => { if (vivo) setAtiv(r.atividade) }).catch(() => { if (vivo) setAtiv([]) }); return () => { vivo = false } }, [api, d.turmas])

  const por = useMemo(() => Object.fromEntries(ORDEM.map(s => [s, d.turmas.filter(t => t.status === s).length])) as Record<Status, number>, [d.turmas])
  const abrir = (t: Turma) => { setTurmaId(t.id); go('cronograma') }
  const filtrar = (s: Status) => { window.location.hash = `turmas?status=${s}` }

  // Fila de atenção: o que depende de alguém agora.
  const fila = useMemo(() => {
    const itens: { t: Turma; peso: number; texto: string; marca: string; atraso: boolean }[] = []
    for (const t of d.turmas) {
      if (t.status === 'validacao') {
        const venceu = !!t.prazo && t.prazo < hoje
        if (equipe || me.validador) itens.push({ t, peso: venceu ? 0 : 1, atraso: venceu, texto: equipe ? 'Aguardando validação da unidade' : 'Aguardando a sua validação', marca: t.prazo ? (venceu ? `prazo venceu em ${br(t.prazo)}` : `prazo até ${br(t.prazo)}`) : 'sem prazo' })
      } else if (equipe && t.status === 'solicitado') itens.push({ t, peso: 2, atraso: false, texto: 'Solicitação nova, ainda não iniciada', marca: t.inicio ? `início desejado ${br(t.inicio)}` : '' })
      else if (equipe && t.status === 'elaboracao' && t.versao > 1) itens.push({ t, peso: 3, atraso: false, texto: `Reaberto (versão ${t.versao}), em elaboração`, marca: `v${t.versao}` })
    }
    return itens.sort((a, b) => a.peso - b.peso)
  }, [d.turmas, equipe, me.validador, hoje])

  // Itens iguais (mesmo nome, unidade e situação) viram uma linha só, com a contagem.
  const grupos = useMemo(() => {
    const m = new Map<string, { itens: typeof fila; n: number }>()
    for (const it of fila) { const k = `${it.t.nome}|${it.t.unidadeId}|${it.texto}`; const g = m.get(k); if (g) { g.itens.push(it); g.n++ } else m.set(k, { itens: [it], n: 1 }) }
    return [...m.values()]
  }, [fila])
  // Destaque: a coisa mais urgente (todas as turmas do mesmo tipo de pendência).
  const destaque = useMemo(() => {
    if (!fila.length) return null
    const topo = fila[0], mesmos = fila.filter(x => x.t.status === topo.t.status)
    const atrasados = mesmos.filter(x => x.atraso).length
    const prazos = mesmos.map(x => x.t.prazo).filter(Boolean).sort()
    const titulo = topo.t.status === 'validacao'
      ? (equipe ? `${mesmos.length} ${mesmos.length === 1 ? 'cronograma aguarda' : 'cronogramas aguardam'} validação da unidade` : `${mesmos.length} ${mesmos.length === 1 ? 'cronograma aguarda' : 'cronogramas aguardam'} a sua validação`)
      : topo.t.status === 'solicitado' ? `${mesmos.length} ${mesmos.length === 1 ? 'solicitação nova' : 'solicitações novas'} para iniciar` : `${mesmos.length} ${mesmos.length === 1 ? 'cronograma reaberto' : 'cronogramas reabertos'} em elaboração`
    const sub = atrasados ? `${atrasados} com prazo vencido${prazos[0] ? ` · o mais antigo vence em ${br(prazos[0])}` : ''}` : prazos[0] ? `O prazo mais próximo é ${br(prazos[0])}.` : 'Abra para ver os detalhes.'
    return { titulo, sub, n: mesmos.length, status: topo.t.status, atraso: atrasados > 0, unico: mesmos.length === 1 ? topo.t : null }
  }, [fila, equipe])

  const unidades = useMemo(() => d.unidades.map(u => {
    const ts = d.turmas.filter(t => t.unidadeId === u.id && t.status !== 'arquivado')
    return { u, total: ts.length, cont: ORDEM.map(s => ({ s, n: ts.filter(t => t.status === s).length })) }
  }).filter(x => x.total > 0), [d.unidades, d.turmas])
  const maxU = Math.max(1, ...unidades.map(x => x.total))

  const marcos = useMemo(() => {
    const out: { chave: string; titulo: string; sub: string; n: number; t?: Turma }[] = []
    for (const t of d.turmas) if (t.inicio && t.status !== 'arquivado') { const n = dias(hoje, t.inicio); if (n >= 0 && n <= 45) out.push({ chave: t.id, titulo: t.nome, sub: n === 0 ? 'começa hoje' : `começa em ${n} ${n === 1 ? 'dia' : 'dias'}`, n, t }) }
    for (const [data, motivo] of d.feriados) { const n = dias(hoje, data); if (n >= 0 && n <= 30) out.push({ chave: `f${data}`, titulo: 'Feriado', sub: `${br(data).slice(0, 5)} · ${motivo}`, n }) }
    return out.sort((a, b) => a.n - b.n).slice(0, 6)
  }, [d.turmas, d.feriados, hoje])

  const caixa = 'rounded-xl border bg-card p-4'
  const filaVis = grupos.slice(0, 6)
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-heading text-2xl font-semibold">{T.inicio.titulo}</h1>
        <p className="text-sm text-muted-foreground">{equipe ? T.inicio.subEquipe : T.inicio.subUnidade}</p>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[1.45fr_1fr]">
        <div className="flex min-w-0 flex-col gap-5">
          <PedidosInicio />
          {destaque ? (
            <section aria-label="Precisa da sua atenção" className={`ce-sobe rounded-2xl p-5 text-white shadow-md ${destaque.atraso ? 'bg-gradient-to-br from-[#8a1c14] to-[#c0392b]' : 'bg-gradient-to-br from-[#0a4ba0] to-[#0077f2]'}`}>
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[.1em] opacity-90">{destaque.atraso && <AlertTriangle size={14} />}Precisa da sua atenção</div>
              <h2 className="mt-1.5 font-heading text-xl font-semibold leading-snug sm:text-2xl">{destaque.titulo}</h2>
              <p className="mt-1 text-sm opacity-95">{destaque.sub}</p>
              <button type="button" onClick={() => (destaque.unico ? abrir(destaque.unico) : filtrar(destaque.status))}
                className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-white px-4 text-sm font-bold text-[#0a4ba0] outline-none transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a4ba0]">
                {destaque.unico ? 'Abrir o cronograma' : `Ver os ${destaque.n}`}<ArrowRight size={16} />
              </button>
            </section>
          ) : (
            <section aria-label="Situação" className="ce-sobe flex items-center gap-3 rounded-2xl border border-ok/40 bg-ok-soft p-5">
              <CheckCircle2 size={28} className="shrink-0 text-ok" /><div><h2 className="font-heading text-lg font-semibold">Tudo em dia</h2><p className="text-sm text-muted-foreground">{T.inicio.acaoVazio}</p></div>
            </section>
          )}

          <section aria-label={T.inicio.status} className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
            {ORDEM.map(st => (
              <button key={st} type="button" onClick={() => filtrar(st)} aria-label={`${por[st]} ${T.status[st]}`} className={`rounded-xl border border-l-[5px] bg-card px-4 py-3 text-left outline-none transition hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary ${COR_STATUS[st].borda} ${por[st] === 0 ? 'opacity-60' : ''}`}>
                <div className={`mono text-3xl font-bold leading-none ${st === 'validacao' && por[st] > 0 ? 'text-warn' : ''}`}>{por[st]}</div>
                <div className="mt-1.5 text-xs font-semibold text-muted-foreground">{T.status[st]}</div>
              </button>
            ))}
          </section>

          <section className={caixa} aria-label={T.inicio.acao}>
            <h2 className="mb-1 font-heading text-base font-semibold">{T.inicio.acao}</h2>
            {grupos.length === 0 ? <p className="text-sm text-muted-foreground">{T.inicio.acaoVazio}</p> : (
              <ul className="divide-y">
                {filaVis.map(({ itens, n }) => { const { t, texto, marca, atraso } = itens[0]; return (
                  <li key={t.id}>
                    <button type="button" onClick={() => (n > 1 ? filtrar(t.status) : abrir(t))} className="flex min-h-[56px] w-full items-center justify-between gap-3 py-2 text-left hover:bg-secondary/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                      <span className="min-w-0"><span className="block truncate text-sm font-medium">{t.nome} · {d.unidades.find(u => u.id === t.unidadeId)?.nome}</span><span className="block text-xs text-muted-foreground">{texto}{n > 1 ? ` · ${n} turmas iguais` : ''}</span></span>
                      <span className={`flex shrink-0 items-center gap-1 text-xs font-semibold ${atraso ? 'text-destructive' : 'text-muted-foreground'}`}>{atraso && <AlertTriangle size={13} />}<span className="max-sm:hidden">{marca}</span><ArrowRight size={14} className="text-muted-foreground" /></span>
                    </button>
                  </li>
                ) })}
              </ul>
            )}
            {grupos.length > filaVis.length && <button type="button" onClick={() => filtrar('validacao')} className="mt-2 text-sm font-semibold text-primary hover:underline">Ver todas as {grupos.length} pendências</button>}
          </section>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <section className={caixa} aria-label={T.inicio.marcos}>
            <h2 className="mb-2 font-heading text-base font-semibold">{T.inicio.marcos}</h2>
            {marcos.length === 0 ? <p className="text-sm text-muted-foreground">{T.inicio.marcosVazio}</p> : (
              <ul className="flex flex-col gap-2">
                {marcos.map(m => (
                  <li key={m.chave}>
                    <button type="button" disabled={!m.t} onClick={() => m.t && abrir(m.t)} className="flex min-h-[48px] w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm enabled:hover:border-primary disabled:cursor-default">
                      <span className="min-w-0"><b className="block truncate font-semibold">{m.titulo}</b><span className="text-xs text-muted-foreground">{m.sub}</span></span>
                      {m.t && <StatusBadge status={m.t.status} />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={caixa} aria-label={T.inicio.atividade}>
            <h2 className="mb-2 font-heading text-base font-semibold">{T.inicio.atividade}</h2>
            {ativ === null ? <p className="text-sm text-muted-foreground">Carregando…</p> : ativ.length === 0 ? <p className="text-sm text-muted-foreground">{T.inicio.atividadeVazio}</p> : (
              <ol className="ml-1.5 border-l-2 pl-4">
                {ativ.slice(0, 5).map(a => {
                  const t = d.turmas.find(x => x.id === a.turmaId)
                  return (
                    <li key={a.id} className="relative pb-3 last:pb-0">
                      <span aria-hidden="true" className="absolute -left-[22px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
                      <button type="button" disabled={!t} onClick={() => t && abrir(t)} className="text-left text-sm hover:underline disabled:no-underline"><b className="font-semibold">{T.hist.acoes[a.acao] || a.acao}</b>{t ? ` · ${t.nome}` : ''}</button>
                      <div className="text-xs text-muted-foreground">{a.quem} · {quando(a.em)}</div>
                    </li>
                  )
                })}
              </ol>
            )}
          </section>

          <section className={caixa} aria-label={T.inicio.unidade}>
            <h2 className="mb-3 font-heading text-base font-semibold">{T.inicio.unidade}</h2>
            {unidades.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma turma ativa.</p> : (
              <ul className="flex flex-col gap-2.5">
                {unidades.map(({ u, total, cont }) => (
                  <li key={u.id} className="grid grid-cols-[minmax(80px,120px)_1fr_24px] items-center gap-2 text-sm">
                    <span className="truncate">{u.nome.replace(/^SENAI\s+/, '')}</span>
                    <span className="flex h-3.5 overflow-hidden rounded-full bg-secondary" style={{ width: `${(total / maxU) * 100}%`, minWidth: 24 }} role="img" aria-label={cont.filter(c => c.n).map(c => `${c.n} ${T.status[c.s]}`).join(', ')}>
                      {cont.filter(c => c.n).map(c => <i key={c.s} className={`block h-full ${COR_STATUS[c.s].barra}`} style={{ width: `${(c.n / total) * 100}%` }} title={`${T.status[c.s]}: ${c.n}`} />)}
                    </span>
                    <b className="mono text-right text-xs">{total}</b>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {ORDEM.slice(0, 4).map(st => <span key={st} className="inline-flex items-center gap-1.5"><i className={`inline-block h-2.5 w-2.5 rounded-sm ${COR_STATUS[st].barra}`} />{T.status[st]}</span>)}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
