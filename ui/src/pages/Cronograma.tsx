import { Fragment, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowLeft, CheckCircle2, OctagonAlert } from 'lucide-react'
import { CronogramaLista, lembrarTurma } from './CronogramaLista'
import { Empty, Field, PessoaSelect, pessoaNome } from '@/components/Fields'
import { FluxoBar } from '@/components/Fluxo'
import { FaixaTurma } from '@/components/FaixaTurma'
import { HistoricoPanel } from '@/components/Historico'
import { CursoPendente } from '@/components/CursoPendente'
import { AbaMensagens, FaixaPedidos } from '@/components/Mensagens'
import { abaPedida, pedidoAberto } from '@/lib/avisos'
import { root } from '@/lib/root'
import { useStore } from '@/lib/store'
import { T } from '@/lib/texts'
import { compute, simularRecalculoPeriodo, corrigirEncontros, cursoTemMomentos, cursoTemPres, temPres, dow, encontros, encontrosRuins, fmt, momentos, planejarEncontros, planejarSincronicos, sincronicos, fmtShort, feriadosDaTurma, fimFaseIntensivaAprendizagem, situacao, toN, toS, todayStr, verificar, workday, type MomentoInstrucional, type Row, type Situacao } from '@/lib/schedule'
import { quando } from '@/lib/format'
import { aplicarConfiguracaoTurma, resolverPerfilCronograma, MODELO_LABEL } from '@/lib/scheduleProfiles'
import type { ExportEntrada } from '@/lib/export'
import type { Encontro, ItemTurma } from '@/lib/types'
import { Timeline } from './Timeline'
import { CartoesEtapas } from '@/components/CartoesEtapas'

type Grupo = 'equipe' | 'encontros' | 'presencial' | 'suporte'
const GRUPOS: Grupo[] = ['equipe', 'encontros', 'presencial', 'suporte']
const SIT_STYLE: Record<Situacao, string> = {
  concluida: 'text-ok', andamento: 'text-primary font-semibold', aIniciar: 'text-muted-foreground', semData: 'text-warn',
}
const ROW_BG: Record<string, string> = { intro: 'bg-row-intro', mat: 'bg-row-intro', rec: 'bg-row-rec', uc: 'bg-card', pratica: 'bg-row-intro' }

/** Barra de navegação do cronograma aberto: volta à lista e troca de turma sem sair daqui. */
function NavCronograma({ turmaId }: { turmaId: string }) {
  const { d, setTurmaId, setCronAberto } = useStore()
  const un = (id: string) => d.unidades.find(u => u.id === id)?.nome || ''
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => setCronAberto(false)} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border bg-card px-3.5 text-sm font-semibold outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-primary"><ArrowLeft size={16} />Todos os cronogramas</button>
      <label className="flex min-w-[200px] flex-1 items-center gap-2 sm:max-w-md sm:flex-none">
        <span className="sr-only">Trocar de cronograma</span>
        <select value={turmaId} onChange={e => setTurmaId(e.target.value)} aria-label="Trocar de cronograma" className="field-input !min-h-[44px]">
          {d.turmas.map(x => <option key={x.id} value={x.id}>{x.nome} · {un(x.unidadeId)}</option>)}
        </select>
      </label>
    </div>
  )
}

export function CronogramaPage() {
  const { cronAberto, d } = useStore()
  // Com uma única turma não há o que escolher: abre direto.
  return cronAberto || d.turmas.length === 1 ? <CronogramaAberto /> : <CronogramaLista />
}

function CronogramaAberto() {
  const { d, update, turmaId, setTurmaId, go, me, lock, avisos: avs, lerAvisos } = useStore()
  const [visao, setVisao] = useState<'tabela' | 'linha'>('tabela')
  const [grupos, setGrupos] = useState<Record<Grupo, boolean>>({ equipe: true, encontros: true, presencial: true, suporte: false })
  const [modulo, setModulo] = useState('todos')
  const [aba, setAba] = useState<'cronograma' | 'webaulas' | 'dados' | 'verif' | 'hist' | 'msgs'>(() => { const a = abaPedida.v; abaPedida.v = ''; return a === 'msgs' ? 'msgs' : 'cronograma' })
  const hoje = todayStr()
  useEffect(() => { if (turmaId) lembrarTurma(turmaId) }, [turmaId])
  // Clique no sino (ou em "Ver conversa") pode pedir uma aba.
  useEffect(() => {
    const f = (e: Event) => { const a = (e as CustomEvent<string>).detail; abaPedida.v = ''; if (a === 'msgs' || a === 'cronograma') setAba(a) }
    window.addEventListener('ce-cron-aba', f); return () => window.removeEventListener('ce-cron-aba', f)
  }, [])
  // Avisos de andamento (enviado, validado…) são lidos ao abrir a turma; pedidos e mensagens só ao ver a conversa.
  useEffect(() => {
    const ids = avs.filter(a => a.turmaId === turmaId && a.meu && !a.lido && a.tipo !== 'pedido' && a.tipo !== 'mensagem').map(a => a.id)
    if (ids.length) void lerAvisos({ ids })
  }, [avs, turmaId, lerAvisos])

  const t = d.turmas.find(x => x.id === turmaId) || d.turmas[0]
  const cursoBase = t ? d.cursos.find(c => c.id === t.cursoId) : undefined
  const curso = cursoBase ? aplicarConfiguracaoTurma(cursoBase, t) : undefined
  const G = useMemo(() => (t && curso ? compute(t, curso, d.feriados) : null), [t, curso, d.feriados])
  const avisos = useMemo(() => (t && G ? verificar(t, G, d.feriados) : []), [t, G, d.feriados])
  const ruins = useMemo(() => encontrosRuins(avisos), [avisos])

  const [confRecalc, setConfRecalc] = useState(false)
  const podeCalcular = !!t && lock(t, 'equipe') === false && me.perfil === 'equipe'
  // Preenche sozinho os encontros que ainda estão sem data, sempre que o início ou os feriados mudam.
  useEffect(() => {
    if (!podeCalcular || !t || !G || !t.inicio) return
    const plano = planejarEncontros(t, G, d.feriados, true)
    const sincronos = planejarSincronicos(t, G, d.feriados, true)
    if (Object.keys(plano).length || Object.keys(sincronos).length) update(x => {
      const tt = x.turmas.find(a => a.id === t.id); if (!tt) return
      for (const [id, enc] of Object.entries(plano)) tt.itens[id] = { ...(tt.itens[id] || {}), enc }
      for (const [id, sin] of Object.entries(sincronos)) tt.itens[id] = { ...(tt.itens[id] || {}), sin }
    })
  }, [podeCalcular, t?.id, t?.inicio, G, d.feriados]) // eslint-disable-line react-hooks/exhaustive-deps

  // Ao mudar o início, as datas dos encontros são recalculadas junto (as digitadas antes deixam de valer).
  const mudarInicio = (v: string) => update(x => { const tt = x.turmas.find(a => a.id === t!.id); if (!tt) return; tt.inicio = v; for (const k of Object.keys(tt.itens)) { if (tt.itens[k]?.enc) delete tt.itens[k].enc; if (tt.itens[k]?.sin) delete tt.itens[k].sin; if (!curso?.modulos.some(m => m.itens.some(it => it.id === k && it.tipo === 'intro' && it.nome.trim().toLocaleLowerCase('pt-BR') === 'ambientação'))) delete tt.itens[k].inicioPlanejado } })

  if (!t) return <Empty titulo={T.cron.semTurma.titulo} texto={T.cron.semTurma.texto} acao={T.cron.semTurma.acao} onAcao={() => go('turmas')} />
  // Solicitação de um curso ainda não cadastrado: só há o pedido; a Unidigit@l cadastra o curso antes de iniciar.
  if (!curso && t.status === 'solicitado' && t.cursoSolicitado) {
    return (
      <div className="flex flex-col gap-4">
        <NavCronograma turmaId={t.id} />
        <div className="min-w-0"><div className="kicker">Solicitação de turma</div><h1 className="text-2xl font-semibold">{t.nome || 'Turma sem nome'}</h1><p className="text-sm text-muted-foreground">Unidade {d.unidades.find(u => u.id === t.unidadeId)?.nome || '—'} · {t.cursoSolicitado} (curso a cadastrar)</p></div>
        <FluxoBar t={t} bloqueios={0} />
        <CursoPendente t={t} />
        <div className="rounded-lg border bg-card p-4 text-sm">
          <div className="kicker mb-1">O que foi pedido</div>
          <p>Início desejado: <b className="mono">{t.inicio ? t.inicio.split('-').reverse().join('/') : 'não informado'}</b></p>
          {t.obs && <p className="mt-1 max-w-prose">{t.obs}</p>}
        </div>
        <HistoricoPanel t={t} />
      </div>
    )
  }
  if (!curso || !G) return <Empty titulo={T.cron.semCurso.titulo} texto={T.cron.semCurso.texto} acao={T.cron.semCurso.acao} onAcao={() => go('turmas')} />
  const unidadeNome = d.unidades.find(u => u.id === t.unidadeId)?.nome || '—'
  const lAj = lock(t, 'ajuste'), lEq = lock(t, 'equipe')
  const comPres = cursoTemPres(curso)
  const comMomentos = cursoTemMomentos(curso)
  const gruposVis = GRUPOS.filter(g => (g !== 'suporte' || me.perfil === 'equipe') && (g !== 'encontros' || comMomentos) && (g !== 'presencial' || comPres))
  const gv = { ...grupos, encontros: grupos.encontros && comMomentos, presencial: grupos.presencial && comPres }
  const nBad = avisos.filter(a => a.nivel === 'bad').length
  const validacaoTxt = t.status === 'validado' && t.vigente ? `Validado por ${t.vigente.por} em ${quando(t.vigente.em).slice(0, 10)} (versão ${t.vigente.versao})${t.vigente.ressalva ? ` · Ressalva: ${t.vigente.ressalva}` : ''}`
    : t.vigente ? `Versão vigente: ${t.vigente.versao}, validada por ${t.vigente.por} em ${quando(t.vigente.em).slice(0, 10)}` : undefined
  const entrada = (): ExportEntrada => ({ turma: t, curso, feriados: d.feriados, pessoas: d.pessoas, unidade: d.unidades.find(u => u.id === t.unidadeId), status: t.status, versao: t.versao, validacao: validacaoTxt, suporte: me.perfil === 'equipe' })

  const setItem = (id: string, patch: Partial<ItemTurma>) => update(x => { const tt = x.turmas.find(a => a.id === t.id)!; tt.itens[id] = { ...(tt.itens[id] || {}), ...patch } })
  const setEnc = (r: Row, i: number, patch: Partial<Encontro>) => {
    const enc = encontros(t, r, curso).map(e => ({ ...e }))
    enc[i] = { ...enc[i], ...patch }
    setItem(r.it.id, { enc })
  }
  const setSin = (r: Row, i: number, patch: Partial<Encontro>) => {
    const sin = sincronicos(t, r, curso).map(e => ({ ...e }))
    sin[i] = { ...sin[i], ...patch }
    setItem(r.it.id, { sin })
  }
  const setMomento = (r: Row, lista: MomentoInstrucional[], i: number, patch: Partial<Encontro>) => {
    const atual = lista[i]
    if (!atual) return
    const tipoIx = lista.slice(0, i + 1).filter(x => x.tipo === atual.tipo).length - 1
    if (atual.tipo === 'sincrono') setSin(r, tipoIx, patch)
    else setEnc(r, tipoIx, patch)
  }
  const R = curso.regras
  // Datas com problema: corrige automaticamente (todas ou só uma) e leva o olhar até a data na tabela.
  const corrigir = (so?: string) => update(x => { const tt = x.turmas.find(a => a.id === t.id)!; for (const [id, enc] of Object.entries(corrigirEncontros(t, G, d.feriados, ruins, so))) tt.itens[id] = { ...(tt.itens[id] || {}), enc } })
  const verNaTabela = (item: string, ix: number, tipo: 'presencial' | 'sincrono') => {
    const nome = G.by[item]?.it.nome
    setAba('cronograma'); setVisao('tabela'); setModulo('todos')
    const rotulo = tipo === 'sincrono' ? 'momento síncrono' : 'encontro presencial'
    setTimeout(() => {
      const el = root.el?.querySelector<HTMLElement>(`[aria-label="Data do ${ix + 1}º ${rotulo} de ${nome}"]`)
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      el?.focus({ preventScroll: true })
    }, 120)
  }
  const irAoErro = (a: typeof avisos[number]) => {
    if (a.ref) return verNaTabela(a.ref.item, a.ref.ix, a.ref.tipo)
    if (a.campo === 'inicio' || a.campo === 'fim') {
      setAba('dados')
      setTimeout(() => {
        const seletor = a.campo === 'inicio' ? '[aria-label="Início da turma"]' : '[aria-label="Término previsto"]'
        const el = root.el?.querySelector<HTMLElement>(seletor)
        el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
        el?.focus({ preventScroll: true })
      }, 120)
    }
  }
  if (t.status === 'solicitado' || curso.resumo) {
    return (
      <div className="flex flex-col gap-4">
        <NavCronograma turmaId={t.id} />
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0"><div className="kicker">Solicitação de turma</div><h1 className="text-2xl font-semibold">{t.nome || 'Turma sem nome'}</h1><p className="text-sm text-muted-foreground">Unidade {unidadeNome} · {curso.nome} · {MODELO_LABEL[curso.modeloCronograma || 'qualificacao']}</p></div>
        </div>
        <FluxoBar t={t} bloqueios={0} />
        <CursoPendente t={t} />
        <div className="rounded-lg border bg-card p-4 text-sm">
          <div className="kicker mb-1">O que foi pedido</div>
          {podeCalcular
            ? <div className="max-w-xs"><Field label="Início da turma (pode ajustar antes de iniciar)"><input type="date" className="field-input" value={t.inicio} onChange={e => mudarInicio(e.target.value)} /></Field></div>
            : <p>Início desejado: <b className="mono">{t.inicio ? t.inicio.split('-').reverse().join('/') : 'não informado'}</b></p>}
          {t.obs && <p className="mt-1 max-w-prose">{t.obs}</p>}
        </div>
        <HistoricoPanel t={t} curso={curso} />
      </div>
    )
  }
  const problemas = avisos.filter(a => a.nivel !== 'ok')
  const emAndamento = G.rows.find(r => r.it.tipo !== 'rec' && situacao(r, hoje) === 'andamento')
  const nEnc = G.rows.reduce((n, r) => n + (r.it.tipo === 'uc' ? momentos(t, r, curso).length : 0), 0)
  const inicio = G.rows[0]?.c.J || t.inicio
  const semUCs = G.rows.length === 0
  const fimTxt = t.fimManual ? fmt(t.fimManual) : G.end ? fmt(G.end) : ''
  const perfilDias = resolverPerfilCronograma(curso)
  const diasNomes = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  const alterarDias = (tipo: 'presencial' | 'sincrono' | 'estudo', dia: number) => update(x => {
    const tt = x.turmas.find(a => a.id === t.id); if (!tt) return
    const cfg = tt.configuracaoCronograma || {}
    const atual = tipo === 'estudo'
      ? perfilDias.diasEstudoPermitidos
      : perfilDias[tipo].diasPermitidos
    const novo = atual.includes(dia) ? atual.filter(d => d !== dia) : [...atual, dia].sort((a, b) => a - b)
    if (!novo.length) return
    tt.personalizarCronograma = true
    if (tipo === 'estudo') tt.configuracaoCronograma = { ...cfg, diasEstudoPermitidos: novo }
    else tt.configuracaoCronograma = { ...cfg, [tipo]: { ...(cfg[tipo] || {}), diasPermitidos: novo } }
  })
  const restaurarDias = () => update(x => {
    const tt = x.turmas.find(a => a.id === t.id); if (!tt) return
    const cfg = { ...(tt.configuracaoCronograma || {}) }
    delete cfg.diasEstudoPermitidos
    if (cfg.presencial) { cfg.presencial = { ...cfg.presencial }; delete cfg.presencial.diasPermitidos }
    if (cfg.sincrono) { cfg.sincrono = { ...cfg.sincrono }; delete cfg.sincrono.diasPermitidos }
    tt.configuracaoCronograma = cfg
  })
  const setFim = (v: string) => update(x => { const a = x.turmas.find(a => a.id === t.id)!; if (v && v !== G.end) a.fimManual = v; else delete a.fimManual })
  const recalcularPeriodo = () => {
    if (!podeCalcular || !t.inicio || !t.fimManual) return
    const semMarcos = { ...t, itens: Object.fromEntries(Object.entries(t.itens).map(([id, it]) => [id, { ...it, inicioPlanejado: curso.modulos.some(m => m.itens.some(item => item.id === id && item.tipo === 'intro' && item.nome.trim().toLocaleLowerCase('pt-BR') === 'ambientação')) ? it.inicioPlanejado : undefined }])) }
    const sim = simularRecalculoPeriodo(semMarcos, curso, d.feriados, t.fimManual)
    if (!sim.ok) { window.alert(sim.motivo); return }
    const marcos = Object.fromEntries(sim.plano.rows
      .filter(r => r.it.tipo !== 'intro' && r.c.J)
      .map(r => [r.it.id, r.c.J!]))
    const itensSimulados = { ...semMarcos.itens }
    for (const [id, data] of Object.entries(marcos))
      itensSimulados[id] = { ...(itensSimulados[id] || {}), inicioPlanejado: data }
    const teste = compute({ ...semMarcos, itens: itensSimulados }, curso, d.feriados)
    if (teste.end !== t.fimManual || teste.rows.some((r, i) =>
      i > 0 && r.it.tipo === 'uc' && r.c.J && teste.rows[i - 1].c.K && r.c.J <= teste.rows[i - 1].c.K!)) {
      window.alert('O calendário não alcançou o término solicitado sem conflitos. Nenhum dado foi alterado.')
      return
    }
    if (!window.confirm('Recalcular o período até ' + fmt(t.fimManual) + '? As UCs serão redistribuídas e os encontros/síncronos já digitados serão substituídos.')) return
    update(x => {
      const tt = x.turmas.find(a => a.id === t.id); if (!tt) return
      for (const [id, item] of Object.entries(tt.itens)) {
        if (curso.modulos.some(m => m.itens.some(it => it.id === id && it.tipo === 'intro' && it.nome.trim().toLocaleLowerCase('pt-BR') === 'ambientação'))) continue
        delete item.inicioPlanejado; delete item.enc; delete item.sin
      }
      for (const [id, data] of Object.entries(marcos))
        tt.itens[id] = { ...(tt.itens[id] || {}), inicioPlanejado: data }
      const g = compute(tt, curso, x.feriados)
      for (const [id, enc] of Object.entries(planejarEncontros(tt, g, x.feriados, false))) tt.itens[id] = { ...(tt.itens[id] || {}), enc }
      for (const [id, sin] of Object.entries(planejarSincronicos(tt, g, x.feriados, false))) tt.itens[id] = { ...(tt.itens[id] || {}), sin }
    })
  }

  const colsEquipe = gv.equipe ? 2 : 0, colsEnc = gv.encontros ? 7 : 0, colsPres = gv.presencial ? 3 : 0, colsSup = grupos.suporte && me.perfil === 'equipe' ? 6 : 0
  const ncol = 9 + colsEquipe + colsEnc + colsPres + colsSup
  const th = 'sticky z-20 border-b border-r bg-secondary px-2 py-1.5 text-left font-heading text-xs font-semibold leading-tight align-bottom'
  const grp = 'sticky top-0 z-20 h-7 border-r px-2 text-center font-heading text-[11px] font-medium uppercase tracking-[.1em]'

  return (
    <div className="flex flex-col gap-4">
      <NavCronograma turmaId={t.id} />
      <FaixaTurma t={t} curso={curso} unidadeNome={unidadeNome} turmas={d.turmas} unidades={d.unidades} inicio={fmt(inicio)} fim={fimTxt} fimManual={!!t.fimManual} onEditarFim={podeCalcular ? () => setAba('dados') : undefined} ch={`${G.sumUC} h`} ucs={G.nUC}
        onTrocar={setTurmaId} entrada={entrada} onEditarInicio={podeCalcular ? () => setAba('dados') : undefined} fimErro={avisos.some(a => a.campo === 'fim')} />

      <FluxoBar t={t} bloqueios={nBad} />
      <FaixaPedidos t={t} />

      {semUCs && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-warn/40 bg-warn-soft px-3 py-2.5 text-sm text-warn">
          <span><b>Este curso ainda não tem unidades curriculares.</b> Sem elas não há como calcular o término. Cadastre as unidades do curso em Cursos; o início da turma você altera na aba Dados da turma.</span>
          <span className="flex gap-2">{podeCalcular && <button type="button" onClick={() => setAba('dados')} className="rounded-md border border-warn/50 bg-card px-3 py-1.5 font-semibold">Alterar início</button>}{me.perfil === 'equipe' && <button type="button" onClick={() => go('cursos')} className="rounded-md bg-warn px-3 py-1.5 font-semibold text-card">Abrir Cursos</button>}</span>
        </div>
      )}

      {!t.inicio && <div className="rounded-md border border-warn/40 bg-warn-soft px-3 py-2 text-sm text-warn">{T.cron.semInicio}</div>}

      <div role="tablist" aria-label="Seções do cronograma" className="flex gap-1 overflow-x-auto border-b-2">
        {([['cronograma', 'Cronograma'], ...(curso.modeloCronograma === 'aprendizagem' ? [['webaulas', 'Webaulas síncronas']] as const : []), ['dados', 'Dados da turma'], ['verif', 'Verificações'], ['msgs', 'Mensagens'], ['hist', 'Histórico']] as const).map(([id, nome]) => (
          <button key={id} type="button" role="tab" aria-selected={aba === id} onClick={() => setAba(id)}
            className={`-mb-0.5 whitespace-nowrap border-b-[3px] px-4 py-2.5 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary ${aba === id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {nome}
            {id === 'msgs' && (() => { const n = avs.filter(a => a.turmaId === t.id && ((a.meu && !a.lido && (a.tipo === 'pedido' || a.tipo === 'mensagem')) || (me.perfil === 'equipe' && pedidoAberto(a)))).length; return n > 0 ? <span className="mono ml-1.5 rounded-full bg-destructive px-1.5 py-px text-[11px] text-destructive-foreground" aria-label={`${n} pendentes`}>{n}</span> : null })()}
            {id === 'verif' && problemas.length > 0 && <span className={`mono ml-1.5 rounded-full px-1.5 py-px text-[11px] ${nBad ? 'bg-destructive text-destructive-foreground' : 'bg-warn text-card'}`}>{problemas.length}</span>}
          </button>
        ))}
      </div>

      {aba === 'dados' && (<>
      <div className="rounded-lg border bg-card p-4" id="dados-turma">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-heading text-base font-semibold">Dados da turma</h2>
          <span className="text-xs text-muted-foreground">{podeCalcular ? 'As alterações são salvas automaticamente.' : ''}</span>
        </div>
        <div className="grid gap-x-4 gap-y-3 sm:grid-cols-3">
          <Field label="Início da turma"><input type="date" className="field-input" disabled={!podeCalcular} value={t.inicio} onChange={e => mudarInicio(e.target.value)} /></Field>
          <Field label={G.end ? 'Término previsto' : 'Término previsto (informe uma data possível)'}>
            <input type="date" className="field-input" disabled={!podeCalcular} value={t.fimManual || G.end || ''} onChange={e => setFim(e.target.value)} />
            {podeCalcular && t.fimManual && <button type="button" className="mt-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground" onClick={recalcularPeriodo}>Recalcular cronograma até o término</button>}
            {G.end && (t.fimManual
              ? <p className="mt-1 text-xs text-muted-foreground">Data alterada manualmente. Calculado: <b className="mono">{fmt(G.end)}</b>{t.fimManual < G.end ? ' (a nova data é anterior ao cálculo)' : ''}. {podeCalcular && <button type="button" className="underline" onClick={() => setFim('')}>Voltar ao cálculo</button>}</p>
              : <p className="mt-1 text-xs text-muted-foreground">Calculado pelas cargas e feriados. Você pode estender ou alterar a data.</p>)}
          </Field>
          {curso.modulos.flatMap(m => m.itens).filter(it => it.tipo === 'intro' && it.nome.trim().toLocaleLowerCase('pt-BR') === 'ambientação').map(it => (
            <Field key={it.id} label="Data da Ambientação (manual, fora da CH)">
              <input type="date" className="field-input" disabled={!podeCalcular} value={t.itens[it.id]?.inicioPlanejado || ''} onChange={e => setItem(it.id, { inicioPlanejado: e.target.value })} />
            </Field>
          ))}
          <div className="sm:col-span-3 rounded-lg border bg-secondary/30 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div><h3 className="font-semibold">Dias permitidos nesta turma</h3><p className="text-xs text-muted-foreground">Personalize os dias de encontros, momentos síncronos e estudo para qualquer modelo, sem alterar o curso original.</p></div>
              {podeCalcular && <button type="button" className="rounded-md border bg-card px-3 py-2 text-xs" onClick={restaurarDias}>Restaurar dias do curso</button>}
            </div>
            {([
              ['presencial', 'Encontros presenciais', perfilDias.presencial.diasPermitidos],
              ['sincrono', 'Momentos síncronos', perfilDias.sincrono.diasPermitidos],
              ['estudo', 'Estudo / cronograma EaD', perfilDias.diasEstudoPermitidos],
            ] as const).map(([tipo, rotulo, dias]) => (
              <fieldset key={tipo} className="mb-3 last:mb-0">
                <legend className="mb-1 text-sm font-semibold">{rotulo}</legend>
                <div className="flex flex-wrap gap-2">
                  {diasNomes.map((nome, dia) => <label key={dia} className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-md border bg-card px-2.5 text-sm">
                    <input type="checkbox" disabled={!podeCalcular || (dias.length === 1 && dias.includes(dia))} checked={dias.includes(dia)} onChange={() => alterarDias(tipo, dia)} />
                    {nome}
                  </label>)}
                </div>
              </fieldset>
            ))}
          </div>
          <Field label="Nome da turma"><input className="field-input" disabled={!podeCalcular} value={t.nome} onChange={e => update(x => { x.turmas.find(a => a.id === t.id)!.nome = e.target.value })} /></Field>
          {comPres && <Field label="Ambiente"><input className="field-input" disabled={lAj} value={t.ambiente} onChange={e => update(x => { x.turmas.find(a => a.id === t.id)!.ambiente = e.target.value })} /></Field>}
        </div>
        {(() => {
          const abrir = (acao: string) => window.dispatchEvent(new CustomEvent('ce-fluxo-abrir', { detail: acao }))
          const btn = 'ml-2 rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-secondary'
          if (podeCalcular) return <p className="mt-2 text-xs text-muted-foreground">Ao mudar o início, as datas das etapas, o término e os encontros são recalculados.</p>
          if (me.perfil === 'consulta') return <p className="mt-2 text-sm text-muted-foreground">Seu perfil é de consulta: você pode ver, mas não alterar.</p>
          if (me.perfil === 'unidade') return <p className="mt-2 text-sm text-muted-foreground">O início da turma é definido pela Unidigit@l. Se precisar mudar, <button type="button" className={btn} onClick={() => abrir('comentar')}>Pedir alteração à Unidigit@l</button></p>
          if (t.status === 'validado') return <p className="mt-2 text-sm text-warn">Esta turma está validada e travada para todos. Para alterar a data de início, reabra para alteração. <button type="button" className={btn} onClick={() => abrir('reabrir')}>Reabrir para alterar</button></p>
          if (t.status === 'arquivado') return <p className="mt-2 text-sm text-warn">Esta turma está arquivada. Restaure para voltar a editar. <button type="button" className={btn} onClick={() => abrir('restaurar')}>Restaurar turma</button></p>
          return null
        })()}
      </div>

      {podeCalcular && t.inicio && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border bg-card px-3 py-2 text-sm">
          <span className="text-muted-foreground">As datas das etapas e o término são calculados a partir do início. Ao mudar o início, os encontros são recalculados (sábados dentro de cada etapa); depois você pode ajustar cada um à mão.</span>
          {!confRecalc
            ? <button type="button" className="ml-auto rounded-md border px-3 py-1.5 font-medium hover:bg-secondary" onClick={() => setConfRecalc(true)}>Recalcular todos os encontros</button>
            : <span className="ml-auto flex items-center gap-2"><span>Substituir as datas já digitadas?</span>
                <button type="button" className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground" onClick={() => { update(x => { const tt = x.turmas.find(a => a.id === t.id)!; for (const [id, enc] of Object.entries(planejarEncontros(t, G, d.feriados, false))) tt.itens[id] = { ...(tt.itens[id] || {}), enc } }); setConfRecalc(false) }}>Recalcular</button>
                <button type="button" className="rounded-md border px-3 py-1.5" onClick={() => setConfRecalc(false)}>Manter</button></span>}
        </div>
      )}

      </>)}

      {aba === 'verif' && (
      <div className="rounded-lg border bg-card">
        <div className="flex items-center gap-2 px-4 py-2.5">
          {problemas.length ? <AlertTriangle size={16} className="text-warn" /> : <CheckCircle2 size={16} className="text-ok" />}
          <h2 className="font-heading text-sm font-semibold">{T.cron.verif.titulo}</h2>
          <span className={`rounded-full px-2 py-0.5 text-xs ${problemas.length ? 'bg-warn-soft text-warn' : 'bg-ok-soft text-ok'}`}>{problemas.length ? T.cron.verif.alertas(problemas.length) : T.cron.verif.tudoCerto}</span>
          {[...ruins].some(k => k.startsWith('presencial:')) && !lAj && <button type="button" onClick={() => corrigir()} className="ml-auto rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:brightness-110">Corrigir datas presenciais automaticamente</button>}
          {ruins.size > 0 && lAj && <span className="ml-auto text-xs text-muted-foreground">Datas em vermelho: só quem pode editar este cronograma consegue corrigir.</span>}
        </div>
        <ul className="flex flex-col gap-1.5 border-t px-4 py-3">
            {avisos.map((a, i) => {
              const partes = a.dt ? a.texto.split(a.dt) : [a.texto]
              return (
                <li key={i} className={`flex flex-wrap items-start gap-2 rounded-md px-2.5 py-1.5 text-sm ${a.nivel === 'ok' ? 'bg-ok-soft text-ok' : a.nivel === 'bad' ? 'bg-bad-soft text-destructive' : 'bg-warn-soft text-warn'}`}>
                  {a.nivel === 'bad' ? <OctagonAlert size={15} className="mt-0.5 shrink-0" /> : a.nivel === 'warn' ? <AlertTriangle size={15} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={15} className="mt-0.5 shrink-0" />}
                  <span className="min-w-0 flex-1"><b className="font-heading uppercase tracking-wide text-[11px]">{a.area}</b>{' '}
                    {partes.map((p, k) => <span key={k}>{k > 0 && <b className="rounded bg-destructive px-1 py-px font-bold text-destructive-foreground">{a.dt}</b>}{p}</span>)}
                  </span>
                  {(a.ref || a.campo) && (
                    <span className="flex shrink-0 gap-1.5">
                      <button type="button" onClick={() => irAoErro(a)} className="rounded-md border border-current/30 bg-card px-2 py-0.5 text-xs font-medium text-foreground hover:bg-secondary">Ir ao erro</button>
                      {!lAj && a.ref?.tipo === 'presencial' && <button type="button" onClick={() => { const ref = a.ref; if (ref?.tipo === 'presencial') corrigir(`presencial:${ref.item}:${ref.ix}`) }} className="rounded-md bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground hover:brightness-110">Corrigir esta data</button>}
                    </span>
                  )}
                </li>
              )
            })}
        </ul>
      </div>
      )}

      {aba === 'cronograma' && (<>
      <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-lg border bg-card px-4 py-2.5 text-sm">
        {[
          [T.cron.resumo.ch, `${G.sumUC} h de ${curso.chTotal} h`],
          ...(comMomentos ? [[T.cron.resumo.enc, String(nEnc)]] : []),
          [T.cron.resumo.hoje, emAndamento ? emAndamento.it.nome : T.cron.resumo.nenhuma],
        ].map(([k, v]) => <span key={k}><span className="text-muted-foreground">{k}: </span><b className="font-semibold">{v}</b></span>)}
      </div>
      {problemas.length > 0 && (
        <button type="button" onClick={() => setAba('verif')} className="flex items-center gap-2 rounded-md border border-warn/40 bg-warn-soft px-3 py-2 text-left text-sm text-warn hover:brightness-95">
          <AlertTriangle size={15} className="shrink-0" /><span>{T.cron.verif.alertas(problemas.length)}. <u>Ver em Verificações</u></span>
        </button>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-md border bg-card p-0.5" role="tablist" aria-label="Visão do cronograma">
          {(['tabela', 'linha'] as const).map(v => (
            <button key={v} role="tab" aria-selected={visao === v} onClick={() => setVisao(v)}
              className={`rounded px-3 py-1 text-sm font-medium ${visao === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>{T.cron.visao[v]}</button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="kicker mr-1">Módulo</span>
          {[['todos', 'Todos'], ...curso.modulos.map(m => [m.id, m.nome])].map(([id, nome]) => (
            <button key={id} onClick={() => setModulo(id)} aria-pressed={modulo === id}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${modulo === id ? 'border-primary bg-accent text-accent-foreground' : 'bg-card text-muted-foreground hover:border-primary'}`}>{nome}</button>
          ))}
        </div>
      </div>

      {visao === 'tabela' && (
        <div className="hidden flex-wrap items-center gap-x-4 gap-y-1.5 md:flex">
          <span className="kicker">Mostrar colunas</span>
          {gruposVis.map(g => (
            <label key={g} className="inline-flex cursor-pointer items-center gap-1.5 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={grupos[g]} onChange={() => setGrupos(s => ({ ...s, [g]: !s[g] }))} />
              {T.cron.grupos[g]}
            </label>
          ))}
        </div>
      )}

      {visao === 'linha' ? <Timeline G={G} t={t} curso={curso} modulo={modulo} hoje={hoje} /> : (<>
        <div className="md:hidden"><CartoesEtapas G={G} t={t} curso={curso} modulo={modulo} hoje={hoje} ruins={ruins} travado={lAj} setMomento={setMomento} /></div>
        <div className="hidden max-h-[75vh] overflow-auto rounded-lg border bg-card md:block">
          <table className="min-w-max border-separate border-spacing-0 text-[13px]">
            <thead>
              <tr>
                <th colSpan={9} className={`${grp} bg-primary text-primary-foreground`}>{T.cron.grupos.prazos}</th>
                {colsEquipe > 0 && <th colSpan={colsEquipe} className={`${grp} bg-brand text-brand-foreground`}>{T.cron.grupos.equipe}</th>}
                {colsEnc > 0 && <th colSpan={colsEnc} className={`${grp} bg-primary text-primary-foreground`}>{T.cron.grupos.encontros}</th>}
                {colsPres > 0 && <th colSpan={colsPres} className={`${grp} bg-brand text-brand-foreground`}>{T.cron.grupos.presencial}</th>}
                {colsSup > 0 && <th colSpan={colsSup} className={`${grp} bg-brand text-brand-foreground`}>{T.cron.grupos.suporte}</th>}
              </tr>
              <tr>
                <th className={`${th} left-0 top-7 z-30 min-w-[280px]`}>Unidade curricular</th>
                {['CH total', 'CH pres.', 'CH dist.', 'Dias de estudo EaD', 'Início', 'Término', 'Término AVA', 'Evento'].map(h => <th key={h} className={`${th} top-7`}>{h}</th>)}
                {gv.equipe && ['Monitor', 'Tutor'].map(h => <th key={h} className={`${th} top-7`}>{h}</th>)}
                {gv.encontros && ['Momento', 'Data', 'Horário', 'Dia da recuperação', 'Webconferência de alinhamento', 'Hora', 'Postagem das notas'].map(h => <th key={h} className={`${th} top-7`}>{h}</th>)}
                {gv.presencial && ['Coordenador técnico', 'Professor presencial', 'Ambiente'].map(h => <th key={h} className={`${th} top-7`}>{h}</th>)}
                {colsSup > 0 && ['SCORM', 'Apostila', 'Avaliação', 'Pesquisa', 'Média do SCORM', 'ID Moodle'].map(h => <th key={h} className={`${th} top-7`}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {curso.modulos.filter(m => modulo === 'todos' || m.id === modulo).map(m => (
                <Fragment key={m.id}>
                  <tr><td colSpan={ncol} className="sticky left-0 border-b bg-row-mod px-3 py-1.5 font-heading text-xs font-semibold uppercase tracking-[.08em]">{m.nome}</td></tr>
                  {m.itens.map(it => {
                    const r = G.by[it.id], c = r.c, st = t.itens[it.id] || {}, mom = momentos(t, r, curso), span = Math.max(1, mom.length)
                    const sit = situacao(r, hoje)
                    const bg = sit === 'andamento' ? 'bg-row-today' : ROW_BG[it.tipo]
                    const rs = { rowSpan: span }
                    return Array.from({ length: span }).map((_, i) => {
                      const e = mom[i] ?? ({ d: '', h: R.horario, w: R.webHora, tipo: 'presencial' } as MomentoInstrucional), semEnc = !mom[i]
                      const tipoIx = mom.slice(0, i + 1).filter(x => x.tipo === e.tipo).length
                      const ruim = it.tipo === 'uc' && ruins.has(`${e.tipo}:${it.id}:${tipoIx - 1}`)
                      return (
                        <tr key={`${it.id}-${i}`}>
                          {i === 0 && (
                            <>
                              <td {...rs} className={`sticky left-0 z-10 min-w-[280px] border-b border-r px-2 py-1.5 ${bg} ${sit === 'andamento' ? 'border-l-4 border-l-primary' : sit === 'concluida' ? 'border-l-4 border-l-ok/50' : 'border-l-4 border-l-transparent'}`}>
                                <div className="font-medium leading-snug">{it.nome}</div>
                                <div className={`text-[11px] ${SIT_STYLE[sit]}`}>{T.cron.sit[sit]}</div>
                              </td>
                              {[it.ch, it.pres, c.H, c.I].map((v, k) => <td key={k} {...rs} className={`mono border-b border-r px-2 text-right ${bg}`}>{v}</td>)}
                              <td {...rs} className={`mono whitespace-nowrap border-b border-r px-2 ${bg}`}>{fmtShort(c.J)}<span className="text-muted-foreground"> · {c.J ? ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][dow(toN(c.J))] : ''}</span></td>
                              <td {...rs} className={`mono whitespace-nowrap border-b border-r px-2 ${bg}`}>{fmtShort(c.K)}<span className="text-muted-foreground"> · {c.K ? ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][dow(toN(c.K))] : ''}</span></td>
                              <td {...rs} className={`mono whitespace-nowrap border-b border-r px-2 text-muted-foreground ${bg}`}>{fmtShort(c.L)}</td>
                              <td {...rs} className={`border-b border-r ${bg}`}>{it.tipo === 'intro' ? null : <input disabled={lEq} className="cell-input mono w-24" value={st.evento ?? ''} placeholder={t.evento} onChange={ev => setItem(it.id, { evento: ev.target.value })} />}</td>
                              {gv.equipe && (
                                <>
                                  <td {...rs} className={`border-b border-r ${bg}`}><PessoaSelect disabled={lEq} papel="monitor" value={st.monitorId} padrao={pessoaNome(d, t.monitorId) || undefined} onChange={v => setItem(it.id, { monitorId: v })} /></td>
                                  <td {...rs} className={`border-b border-r ${bg}`}><PessoaSelect disabled={lEq} papel="tutor" value={st.tutorId} padrao={pessoaNome(d, t.tutorId) || undefined} onChange={v => setItem(it.id, { tutorId: v })} /></td>
                                </>
                              )}
                            </>
                          )}
                          {gv.encontros && (mom.length === 0 ? (i === 0 ? <td colSpan={7} {...rs} className={`border-b border-r ${bg}`} /> : null) : (it.tipo === 'uc' || it.tipo === 'intro' ? (
                            <>
                              <td className={`whitespace-nowrap border-b border-r px-2 text-center ${bg}`}>{it.tipo === 'uc' ? `${tipoIx}º ${e.tipo === 'sincrono' ? 'Sínc.' : 'Pres.'}` : ''}</td>
                              <td className={`border-b border-r px-1 ${bg} ${ruim ? '!bg-bad-soft' : ''}`}>
                                {it.tipo === 'intro' ? <span className="mono whitespace-nowrap px-1.5">{fmt(e.d)}</span> : <input type="date" disabled={lAj || semEnc} className={`cell-input mono w-[138px] ${ruim ? '!font-bold !text-destructive ring-2 ring-destructive' : ''}`} title={semEnc ? 'Não há momento configurado para esta linha.' : ruim ? 'Esta data precisa de correção. Veja em Verificações.' : undefined} aria-invalid={ruim || undefined} value={e.d} onChange={ev => setMomento(r, mom, i, { d: ev.target.value })} aria-label={`Data do ${tipoIx}º ${e.tipo === 'sincrono' ? 'momento síncrono' : 'encontro presencial'} de ${it.nome}`} />}
                              </td>
                              <td className={`border-b border-r ${bg}`}>{it.tipo === 'intro' ? <span className="whitespace-nowrap px-1.5">{e.h}</span> : <input disabled={lAj} className="cell-input min-w-[150px]" value={e.h} onChange={ev => setMomento(r, mom, i, { h: ev.target.value })} />}</td>
                              {i === 0 && <td {...rs} className={`border-b border-r ${bg}`}>{it.tipo === 'uc' && <input disabled={lEq} className="cell-input w-24" value={st.rec ?? '-'} onChange={ev => setItem(it.id, { rec: ev.target.value })} />}</td>}
                              <td className={`mono whitespace-nowrap border-b border-r px-2 ${bg}`}>{e.d ? fmt(toS(toN(e.d) - R.webDias)) : ''}</td>
                              <td className={`border-b border-r ${bg}`}>{it.tipo === 'intro' ? <span className="px-1.5">{e.w}</span> : <input disabled={lAj} className="cell-input mono w-16" value={e.w} onChange={ev => setMomento(r, mom, i, { w: ev.target.value })} />}</td>
                              <td className={`mono whitespace-nowrap border-b border-r px-2 ${bg}`}>{e.d ? fmt(workday(e.d, R.postDias, new Set(feriadosDaTurma(t, d.feriados).map(f => f[0])))) : ''}</td>
                            </>
                          ) : (
                            <>
                              <td className={`mono border-b border-r px-2 text-center ${bg}`}>{it.tipo === 'mat' ? 'R' : '-'}</td>
                              {[0, 1, 2, 3, 4, 5].map(k => <td key={k} className={`border-b border-r px-2 text-center text-muted-foreground ${bg}`}>{it.tipo === 'rec' && k < 2 ? '-' : ''}</td>)}
                            </>
                          )))}
                          {i === 0 && gv.presencial && (!temPres(it) ? <td colSpan={3} {...rs} className={`border-b border-r ${bg}`} /> : (
                            <>
                              <td {...rs} className={`border-b border-r ${bg}`}><PessoaSelect disabled={lAj} papel="coordenador" value={st.coordId} padrao={pessoaNome(d, t.coordId) || undefined} onChange={v => setItem(it.id, { coordId: v })} /></td>
                              <td {...rs} className={`border-b border-r ${bg}`}><PessoaSelect disabled={lAj} papel="professor" value={st.profId} padrao={pessoaNome(d, t.profId) || undefined} onChange={v => setItem(it.id, { profId: v })} /></td>
                              <td {...rs} className={`border-b border-r ${bg}`}><input disabled={lAj} className="cell-input min-w-[140px]" value={st.ambiente ?? ''} placeholder={t.ambiente} onChange={ev => setItem(it.id, { ambiente: ev.target.value })} /></td>
                            </>
                          ))}
                          {i === 0 && colsSup > 0 && (['scorm', 'apostila', 'aval', 'pesq', 'media', 'idm'] as const).map(f => (
                            <td key={f} {...rs} className={`border-b border-r ${bg}`}><input disabled={lEq} className="cell-input min-w-[110px]" value={st[f] ?? ''} onChange={ev => setItem(it.id, { [f]: ev.target.value })} aria-label={`${f} de ${it.nome}`} /></td>
                          ))}
                        </tr>
                      )
                    })
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </>)}
      <p className="text-xs text-muted-foreground">{T.cron.legenda}</p>
      {curso.nota && <p className="text-xs text-muted-foreground">{curso.nota}</p>}
      </>)}


      {aba === 'webaulas' && curso.modeloCronograma === 'aprendizagem' && (() => {
        const hol = new Set(feriadosDaTurma(t, d.feriados).map(f => f[0]))
        const fimIntensivo = t.inicio ? fimFaseIntensivaAprendizagem(t.inicio, curso, hol) : null
        const linhas = G.rows.filter(r => r.it.tipo === 'uc').flatMap(r => sincronicos(t, r, curso).map((e, ix) => ({ r, e, ix })))
        return <div className="flex flex-col gap-3">
          <div className="rounded-lg border bg-card p-4">
            <h2 className="font-heading text-base font-semibold">Regra de atendimento da Aprendizagem</h2>
            <p className="mt-1 text-sm text-muted-foreground">Fase intensiva: atendimento nos dias úteis configurados desde o início da turma{fimIntensivo ? <> até <b className="mono">{fmt(fimIntensivo)}</b></> : ''}. Depois, o sistema mantém somente os dias semanais definidos no cadastro do curso.</p>
          </div>
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full min-w-[760px] text-sm">
              <thead><tr className="border-b bg-secondary text-left"><th className="px-3 py-2">Unidade curricular</th><th className="px-3 py-2">Nº</th><th className="px-3 py-2">Data da webaula</th><th className="px-3 py-2">Dia</th><th className="px-3 py-2">Horário</th><th className="px-3 py-2">Fase</th></tr></thead>
              <tbody>{linhas.length ? linhas.map(({ r, e, ix }) => {
                const ruimWeb = ruins.has(`sincrono:${r.it.id}:${ix}`)
                return <tr key={`${r.it.id}-web-${ix}`} className="border-b">
                <td className="px-3 py-2 font-medium">{r.it.nome}</td>
                <td className="mono px-3 py-2">{ix + 1}º</td>
                <td className={`px-2 py-1 ${ruimWeb ? 'bg-bad-soft' : ''}`}><input type="date" disabled={lAj} aria-invalid={ruimWeb || undefined} aria-label={`Data do ${ix + 1}º momento síncrono de ${r.it.nome}`} title={ruimWeb ? 'Esta data está fora das regras do cronograma. Veja em Verificações.' : undefined} className={`cell-input mono w-[145px] ${ruimWeb ? '!font-bold !text-destructive ring-2 ring-destructive' : ''}`} value={e.d} onChange={ev => setSin(r, ix, { d: ev.target.value })} /></td>
                <td className="px-3 py-2">{e.d ? ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][dow(toN(e.d))] : '—'}</td>
                <td className="px-2 py-1"><input disabled={lAj} className="cell-input min-w-[155px]" value={e.h} onChange={ev => setSin(r, ix, { h: ev.target.value })} /></td>
                <td className="px-3 py-2">{e.d && fimIntensivo && e.d <= fimIntensivo ? 'Intensiva' : 'Semanal'}</td>
              </tr>}) : <tr><td colSpan={6} className="px-3 py-5 text-center text-muted-foreground">Informe a data de início da turma para gerar as webaulas.</td></tr>}</tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">As datas são recalculadas automaticamente quando o início da turma, os feriados ou a regra de atendimento do curso mudam. Datas alteradas manualmente são preservadas até um recálculo completo.</p>
        </div>
      })()}

      {aba === 'msgs' && <AbaMensagens t={t} />}

      {aba === 'hist' && <HistoricoPanel t={t} curso={curso} semCabecalho />}
    </div>
  )
}
