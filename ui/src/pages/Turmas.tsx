import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ArrowLeft, BellRing, Copy, Plus, Search, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Confirm, Empty, Field, Panel, PessoaSelect, Secao, pessoaNome, uid, type ConfirmCopy } from '@/components/Fields'
import { StatusBadge } from '@/components/Status'
import { useStore } from '@/lib/store'
import { T } from '@/lib/texts'
import { compute, cursoTemPres, fmt } from '@/lib/schedule'
import type { Status, Turma } from '@/lib/types'

export function TurmasPage() {
  const { d, update, turmaId, setTurmaId, go, me, lock, criarTurma, excluirTurma, avisos } = useStore()
  /** Pedidos abertos (Unidigit@l) ou mensagens novas (unidade) desta turma. */
  const pend = (id: string) => avisos.filter(a => a.turmaId === id && (me.perfil === 'equipe' ? a.pedido && !a.atendidoEm : a.meu && !a.lido && a.tipo === 'mensagem')).length
  const [confirma, setConfirma] = useState<ConfirmCopy | null>(null)
  const [verArq, setVerArq] = useState(false)
  const [novo, setNovo] = useState(false)
  const [busca, setBusca] = useState('')
  const [detalhe, setDetalhe] = useState(false) // no celular: lista ou detalhe, um de cada vez
  // O filtro de status pode vir da página Início (#turmas?status=validado).
  const lerFiltro = () => { const s = new URLSearchParams(window.location.hash.split('?')[1] || '').get('status'); return (s && s in T.status ? s : '') as Status | '' }
  const [filtro, setFiltro] = useState<Status | ''>(lerFiltro)
  useEffect(() => { const f = () => setFiltro(lerFiltro()); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f) }, [])
  const escolher = (s: Status | '') => { setFiltro(s); history.replaceState(null, '', s ? `#turmas?status=${s}` : '#turmas') }
  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return d.turmas.filter(x => (filtro ? x.status === filtro : verArq || x.status !== 'arquivado') && (!q || `${x.nome} ${d.cursos.find(c => c.id === x.cursoId)?.nome || x.cursoSolicitado || ''} ${d.unidades.find(u => u.id === x.unidadeId)?.nome || ''}`.toLowerCase().includes(q)))
  }, [d.turmas, d.cursos, d.unidades, verArq, filtro, busca])
  const t = d.turmas.find(x => x.id === turmaId) || lista[0]
  const curso = t ? d.cursos.find(c => c.id === t.cursoId) : undefined
  const comPres = !curso || !!curso.resumo || cursoTemPres(curso)
  const G = useMemo(() => (t && curso && !curso.resumo ? compute(t, curso, d.feriados) : null), [t, curso, d.feriados])
  const equipe = me.perfil === 'equipe'
  const set = <K extends keyof Turma>(k: K, v: Turma[K]) => update(x => { x.turmas.find(a => a.id === t.id)![k] = v })
  const lEq = lock(t, 'equipe'), lAj = lock(t, 'ajuste')
  const preparo = equipe && !!t && (t.status === 'solicitado' || t.status === 'elaboracao')
  const unidadeNome = (id: string) => d.unidades.find(u => u.id === id)?.nome || 'Sem unidade'

  const duplicar = async () => {
    const n: Turma = { ...JSON.parse(JSON.stringify(t)), id: uid('t'), nome: `${t.nome} (cópia)`, status: 'elaboracao', versao: 1, rev: 1, prazo: '', vigente: null }
    try { await criarTurma(n); toast(T.turmas.duplicada) } catch (e) { toast(e instanceof Error ? e.message : 'Não foi possível duplicar.') }
  }
  const excluir = async () => { try { await excluirTurma(t.id) } catch (e) { toast(e instanceof Error ? e.message : 'Não foi possível excluir.') } }

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(240px,340px)_minmax(0,1fr)]">
      <Panel className={detalhe ? 'max-md:hidden' : ''} title={T.turmas.titulo} actions={me.perfil !== 'consulta' && <Button size="sm" onClick={() => setNovo(true)}><Plus size={14} />{equipe ? T.turmas.nova : T.turmas.solicitar}</Button>}>
        <label className="relative mb-3 block"><span className="sr-only">Buscar turma, curso ou unidade</span>
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="search" className="field-input min-h-[44px] !pl-9 md:min-h-0" placeholder="Buscar turma, curso ou unidade" value={busca} onChange={e => setBusca(e.target.value)} />
        </label>
        <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por status">
          {([['', 'Todas'], ['solicitado', 'Solicitadas'], ['elaboracao', 'Em elaboração'], ['validacao', 'Em validação'], ['validado', 'Validadas'], ...(equipe ? [['arquivado', 'Arquivadas']] : [])] as [Status | '', string][]).map(([k, nome]) => (
            <button key={k} type="button" aria-pressed={filtro === k} onClick={() => escolher(k)} className={`rounded-full border px-3 py-1.5 text-xs font-medium md:py-0.5 ${filtro === k ? 'border-primary bg-accent text-accent-foreground' : 'bg-card text-muted-foreground hover:border-primary'}`}>{nome}</button>
          ))}
        </div>
        {lista.length === 0 ? <p className="text-sm text-muted-foreground">{busca ? 'Nenhuma turma encontrada para esta busca.' : filtro ? 'Nenhuma turma com este status.' : equipe ? T.turmas.vazio.texto : T.turmas.vazioUnidade}</p> : (
          <ul className="flex flex-col gap-1.5">
            {lista.map(x => {
              const c = d.cursos.find(k => k.id === x.cursoId)
              return (
                <li key={x.id}>
                  <button onClick={() => { setTurmaId(x.id); setDetalhe(true) }} aria-current={t?.id === x.id}
                    className={`flex min-h-[56px] w-full flex-col gap-1 rounded-lg border px-3 py-2 text-left ${t?.id === x.id ? 'border-primary bg-accent' : 'bg-card hover:border-primary'}`}>
                    <span className="flex items-center justify-between gap-2"><span className="min-w-0 truncate font-medium">{x.nome || 'Turma sem nome'}</span><span className="mono shrink-0 text-xs text-muted-foreground">{x.inicio ? x.inicio.split('-').reverse().join('/') : '—'}</span></span>
                    <span className="flex items-center justify-between gap-2"><span className="min-w-0 truncate text-xs text-muted-foreground">{unidadeNome(x.unidadeId)} · {c?.nome || (x.cursoSolicitado ? `${x.cursoSolicitado} (a cadastrar)` : 'Sem curso')}</span><span className="flex shrink-0 items-center gap-1.5">{pend(x.id) > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-destructive px-1.5 py-0.5 text-[11px] font-bold text-destructive-foreground" title="Há pedido ou mensagem pendente"><BellRing size={11} />{pend(x.id)}</span>}<StatusBadge status={x.status} versao={x.versao} /></span></span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        {equipe && d.turmas.some(x => x.status === 'arquivado') && (
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={verArq} onChange={e => setVerArq(e.target.checked)} />{T.turmas.mostrarArquivadas}</label>
        )}
      </Panel>
      {!t ? <Empty titulo={T.turmas.vazio.titulo} texto={equipe ? T.turmas.vazio.texto : T.turmas.vazioUnidade} acao={me.perfil !== 'consulta' ? (equipe ? T.turmas.nova : T.turmas.solicitar) : undefined} onAcao={() => setNovo(true)} /> : (
        <Panel className={detalhe ? '' : 'max-md:hidden'} title={T.turmas.dados} actions={<>
          <Button size="sm" onClick={() => { setTurmaId(t.id); go('cronograma') }}>{T.turmas.abrir}</Button>
          {equipe && <Button size="sm" variant="outline" onClick={() => void duplicar()}><Copy size={14} />{T.turmas.duplicar}</Button>}
          {equipe && ['solicitado', 'elaboracao', 'arquivado'].includes(t.status) && <Button size="sm" variant="outline" className="text-destructive" onClick={() => setConfirma(T.turmas.confirma(t.nome))}><Trash2 size={14} />{T.turmas.excluir}</Button>}
        </>}>
          <button type="button" onClick={() => setDetalhe(false)} className="mb-3 inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-primary md:hidden"><ArrowLeft size={16} />Voltar para as turmas</button>
          <div className="mb-3 flex flex-wrap items-center gap-2"><StatusBadge status={t.status} versao={t.versao} /><span className="text-sm text-muted-foreground">{unidadeNome(t.unidadeId)}</span></div>
          <div className="flex flex-col gap-3">
          <Secao titulo="Identificação" resumo={`${t.nome || 'Sem nome'} · ${unidadeNome(t.unidadeId)} · ${curso?.nome || 'Sem curso'}`} aberta>
          <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
            <Field label="Nome da turma"><input disabled={lEq} className="field-input" value={t.nome} onChange={e => set('nome', e.target.value)} /></Field>
            <Field label="Unidade">
              <select disabled={!preparo} className="field-input" value={t.unidadeId} onChange={e => set('unidadeId', e.target.value)}>{d.unidades.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}</select>
            </Field>
            <Field label="Curso">
              <select disabled={!preparo} className="field-input" value={t.cursoId} onChange={e => set('cursoId', e.target.value)}>{d.cursos.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
            </Field>
            {equipe && <Field label="Evento (ID do Moodle)"><input disabled={lEq} className="field-input mono" value={t.evento} onChange={e => set('evento', e.target.value)} /></Field>}
            {comPres && <Field label="Ambiente"><input disabled={lAj} className="field-input" value={t.ambiente} onChange={e => set('ambiente', e.target.value)} /></Field>}
          </div>
          </Secao>
          <Secao titulo="Datas" resumo={`${fmt(t.inicio) || 'sem início'} → ${fmt(G?.end || t.fimManual) || 'sem término'}`} aberta>
          <div className="max-w-xs"><Field label="Início da turma"><input disabled={lEq} type="date" className="field-input min-h-[44px] md:min-h-0" value={t.inicio} onChange={e => set('inicio', e.target.value)} /></Field></div>
          {G && (
            <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border">
              <div className="bg-card px-3.5 py-2.5"><div className="kicker">Início</div><div className="mono mt-0.5">{fmt(G.rows[0]?.c.J || t.inicio) || 'Informe o início acima'}</div></div>
              <div className="bg-card px-3.5 py-2.5"><div className="kicker">Término previsto</div><input type="date" disabled={lEq} aria-label="Término previsto" className="field-input mono mt-0.5 !py-1" value={t.fimManual || G.end || ''} onChange={e => set('fimManual', e.target.value && e.target.value !== G.end ? e.target.value : '')} />
              {G.end && <div className="mt-0.5 text-xs text-muted-foreground">{t.fimManual ? <>Alterado. Calculado: <b className="mono">{fmt(G.end)}</b>. {!lEq && <button type="button" className="underline" onClick={() => set('fimManual', '')}>Voltar ao cálculo</button>}</> : 'Calculado. Você pode estender ou alterar.'}</div>}
              {!G.end && <div className="mt-0.5 text-xs text-muted-foreground">Não foi possível calcular. Informe uma data possível. {!G.rows.length && <>O curso não tem unidades curriculares. {equipe && <button type="button" className="underline" onClick={() => go('cursos')}>Cadastrar em Cursos</button>}</>}</div>}</div>
            </div>
          )}
          </Secao>
          <Secao titulo="Equipe" resumo={[pessoaNome(d, t.monitorId), pessoaNome(d, t.tutorId)].filter(Boolean).join(' · ') || 'Ninguém definido'}>
          <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
            <Field label="Monitor padrão"><PessoaSelect disabled={lEq} className="field-input" papel="monitor" value={t.monitorId} onChange={v => set('monitorId', v)} /></Field>
            <Field label="Tutor padrão"><PessoaSelect disabled={lEq} className="field-input" papel="tutor" value={t.tutorId} onChange={v => set('tutorId', v)} /></Field>
            {comPres && <Field label="Coordenador técnico"><PessoaSelect disabled={lAj} className="field-input" papel="coordenador" value={t.coordId} onChange={v => set('coordId', v)} /></Field>}
            {comPres && <Field label="Professor presencial"><PessoaSelect disabled={lAj} className="field-input" papel="professor" value={t.profId} onChange={v => set('profId', v)} /></Field>}
          </div>
          </Secao>
          <Secao titulo="Observações" resumo={t.obs || 'Sem observações'} aberta={!!t.obs}>
          <div><Field label="Observações"><textarea disabled={lEq} className="field-input min-h-[64px]" value={t.obs || ''} onChange={e => set('obs', e.target.value)} /></Field></div>
          </Secao>
          <p className="text-xs text-muted-foreground">{equipe ? T.turmas.ajuda : T.turmas.ajudaUnidade}</p>
          </div>
        </Panel>
      )}
      <Confirm copy={confirma} onClose={() => setConfirma(null)} onConfirm={() => void excluir()} />
      <NovaTurma aberto={novo} onClose={() => setNovo(false)} />
    </div>
  )
}

function NovaTurma({ aberto, onClose }: { aberto: boolean; onClose: () => void }) {
  const { d, me, criarTurma } = useStore()
  const equipe = me.perfil === 'equipe'
  const [nome, setNome] = useState('')
  const [cursoId, setCursoId] = useState('')
  const [unidadeId, setUnidadeId] = useState('')
  const [inicio, setInicio] = useState('')
  const [obs, setObs] = useState('')
  const [outro, setOutro] = useState(false)
  const [cursoNovo, setCursoNovo] = useState('')
  const [erro, setErro] = useState('')
  const [busy, setBusy] = useState(false)
  const unidades = d.unidades
  const criar = async () => {
    const c = outro ? '' : (cursoId || d.cursos[0]?.id), u = unidadeId || unidades[0]?.id
    if (outro && !cursoNovo.trim()) { setErro('Informe o nome do curso que você precisa.'); return }
    if (!c && !outro) { setErro('Cadastre um curso antes de criar a turma.'); return }
    if (!u) { setErro('Cadastre uma unidade antes de criar a turma.'); return }
    if (!nome.trim()) { setErro('Informe o nome da turma.'); return }
    setBusy(true); setErro('')
    try {
      await criarTurma({ id: uid('t'), cursoId: c || '', ...(outro ? { cursoSolicitado: cursoNovo.trim() } : {}), unidadeId: u, nome: nome.trim(), inicio, obs: obs.trim(), evento: '', monitorId: '', tutorId: '', coordId: '', profId: '', ambiente: '', itens: {} })
      toast(equipe ? T.turmas.criada : T.turmas.solicitada); setNome(''); setInicio(''); setObs(''); setOutro(false); setCursoNovo(''); onClose()
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível salvar.') } finally { setBusy(false) }
  }
  return (
    <Dialog open={aberto} onOpenChange={o => { if (!o && !busy) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{equipe ? T.turmas.nova : T.turmas.solicitar}</DialogTitle>
          <DialogDescription>{equipe ? T.turmas.novaTexto : T.turmas.solicitarTexto}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Nome da turma"><input className="field-input" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: TST 2026/2" /></Field>
          <Field label="Curso"><select className="field-input" value={outro ? '__outro' : (cursoId || d.cursos[0]?.id || '')} onChange={e => { if (e.target.value === '__outro') setOutro(true); else { setOutro(false); setCursoId(e.target.value) } }}>{d.cursos.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}{!equipe && <option value="__outro">Meu curso não está na lista…</option>}</select></Field>
          {outro && <Field label="Nome do curso"><input className="field-input" value={cursoNovo} onChange={e => setCursoNovo(e.target.value)} placeholder="Ex.: Técnico em Logística" /><p className="mt-1 text-xs text-muted-foreground">A Unidigit@l vai cadastrar este curso e dar continuidade à sua solicitação.</p></Field>}
          {(equipe || unidades.length > 1) && <Field label="Unidade"><select className="field-input" value={unidadeId || unidades[0]?.id || ''} onChange={e => setUnidadeId(e.target.value)}>{unidades.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}</select></Field>}
          <Field label={equipe ? 'Início da turma' : 'Início desejado'}><input type="date" className="field-input" value={inicio} onChange={e => setInicio(e.target.value)} /></Field>
          <Field label="Observações"><textarea className="field-input min-h-[64px]" value={obs} onChange={e => setObs(e.target.value)} /></Field>
          {erro && <p role="alert" className="rounded-md bg-bad-soft px-3 py-2 text-sm text-destructive">{erro}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>{T.geral.cancelar}</Button>
          <Button onClick={() => void criar()} disabled={busy}>{equipe ? 'Criar turma' : 'Enviar solicitação'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
