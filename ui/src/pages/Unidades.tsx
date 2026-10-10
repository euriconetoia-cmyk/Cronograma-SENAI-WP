import { useState } from 'react'
import { toast } from 'sonner'
import { Building2, CheckCircle2, MapPin, RefreshCw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Confirm, Empty, Panel, uid, type ConfirmCopy } from '@/components/Fields'
import { useStore } from '@/lib/store'
import { T } from '@/lib/texts'
import type { Unidade } from '@/lib/types'

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']
const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')

export function UnidadesPage() {
  const { api, d, update } = useStore()
  const [nome, setNome] = useState('')
  const [cidade, setCidade] = useState('')
  const [estado, setEstado] = useState('GO')
  const [validando, setValidando] = useState('')
  const [confirma, setConfirma] = useState<{ copy: ConfirmCopy; id: string } | null>(null)

  const resolverCidade = async (uf: string, nomeCidade: string) => {
    if (!uf || !nomeCidade.trim()) throw new Error('Informe o estado e a cidade da unidade.')
    const r = await api.municipios(uf)
    const alvo = norm(nomeCidade)
    const m = r.municipios.find(x => norm(x.nome) === alvo)
    if (!m) throw new Error(`Não encontrei "${nomeCidade}" entre os municípios de ${uf}. Confira o nome da cidade.`)
    return m
  }

  const add = async () => {
    if (!nome.trim()) { toast(T.unidades.informeNome); return }
    if (!estado) { toast('Informe o estado da unidade.'); return }
    if (!cidade.trim()) { toast('Informe a cidade da unidade.'); return }
    setValidando('nova')
    try {
      const m = await resolverCidade(estado, cidade)
      update(x => { x.unidades.push({ id: uid('u'), nome: nome.trim(), cidade: m.nome, estado, codigoIbge: m.codigoIbge }) })
      setNome(''); setCidade(''); setEstado('GO')
      toast(`Unidade adicionada. Localidade validada: ${m.nome}/${estado}.`)
    } catch (e) { toast(e instanceof Error ? e.message : 'Não foi possível validar a localidade.') }
    finally { setValidando('') }
  }

  const validar = async (u: Unidade) => {
    setValidando(u.id)
    try {
      const m = await resolverCidade(u.estado, u.cidade || '')
      update(s => {
        const alvo = s.unidades.find(a => a.id === u.id)
        if (alvo) { alvo.cidade = m.nome; alvo.codigoIbge = m.codigoIbge }
      })
      toast(`Localidade validada: ${m.nome}/${u.estado}. Calendário regional disponível.`)
    } catch (e) { toast(e instanceof Error ? e.message : 'Não foi possível validar a localidade.') }
    finally { setValidando('') }
  }

  const remover = (id: string, n: string) => {
    if (d.turmas.some(t => t.unidadeId === id)) { toast(T.unidades.emUso); return }
    setConfirma({ copy: T.unidades.confirma(n), id })
  }

  return (
    <div className="flex flex-col gap-4">
      <Panel title={T.unidades.titulo}>
        <p className="mb-3 max-w-3xl text-sm text-muted-foreground">Informe a unidade, o estado e a cidade. O sistema valida o município, identifica automaticamente o código IBGE e usa essa localização para montar o calendário de feriados estaduais e municipais.</p>
        <form className="flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); void add() }}>
          <label className="flex min-w-[240px] flex-1 flex-col gap-1"><span className="kicker">{T.unidades.nome}</span><input className="field-input" value={nome} onChange={e => setNome(e.target.value)} /></label>
          <label className="flex min-w-[200px] flex-col gap-1"><span className="kicker">{T.unidades.cidade}</span><input className="field-input" placeholder="Ex.: Goiânia" value={cidade} onChange={e => setCidade(e.target.value)} /></label>
          <label className="flex min-w-[130px] flex-col gap-1"><span className="kicker">Estado</span><select className="field-input" value={estado} onChange={e => setEstado(e.target.value)}>{UFS.map(uf => <option key={uf}>{uf}</option>)}</select></label>
          <Button type="submit" disabled={validando === 'nova'}><Building2 size={15} />{validando === 'nova' ? 'Validando...' : T.unidades.adicionar}</Button>
        </form>
      </Panel>

      {d.unidades.length === 0 ? <Empty titulo={T.unidades.vazio.titulo} texto={T.unidades.vazio.texto} /> : (
        <Panel>
          <ul className="flex flex-col divide-y">
            {d.unidades.map(u => {
              const n = d.turmas.filter(t => t.unidadeId === u.id).length
              const validada = /^\d{7}$/.test(u.codigoIbge || '')
              return (
                <li key={u.id} className="grid gap-2 py-3 lg:grid-cols-[minmax(200px,1fr)_190px_90px_170px_auto] lg:items-center">
                  <input aria-label={`Nome da unidade ${u.nome}`} className="cell-input min-w-[200px] text-sm" value={u.nome} onChange={e => update(s => { s.unidades.find(a => a.id === u.id)!.nome = e.target.value })} />
                  <input aria-label={`Cidade de ${u.nome}`} className={`cell-input text-sm ${!validada ? '!border-warn' : ''}`} placeholder="Cidade" value={u.cidade || ''} onChange={e => update(s => { const a=s.unidades.find(a => a.id === u.id)!; a.cidade=e.target.value; a.codigoIbge='' })} />
                  <select aria-label={`Estado de ${u.nome}`} className="cell-input text-sm" value={u.estado || ''} onChange={e => update(s => { const a=s.unidades.find(a => a.id === u.id)!; a.estado=e.target.value; a.codigoIbge='' })}><option value="">UF</option>{UFS.map(uf => <option key={uf}>{uf}</option>)}</select>
                  <div className={`flex min-h-9 items-center gap-2 rounded-md border px-2 text-xs ${validada ? 'border-ok/30 bg-ok-soft text-ok' : 'border-warn/30 bg-warn-soft text-warn'}`}>
                    {validada ? <CheckCircle2 size={14}/> : <MapPin size={14}/>}
                    <span>{validada ? `IBGE ${u.codigoIbge}` : 'Localidade não validada'}</span>
                  </div>
                  <div className="flex items-center justify-end gap-1">
                    <span className="mono mr-1 text-xs text-muted-foreground">{n} {n === 1 ? 'turma' : 'turmas'}</span>
                    <Button size="sm" variant="outline" disabled={validando === u.id} onClick={() => void validar(u)} title="Validar cidade e preparar calendário regional"><RefreshCw size={14} className={validando === u.id ? 'animate-spin' : ''}/>{validada ? 'Revalidar' : 'Validar'}</Button>
                    <Button size="icon" variant="ghost" className="text-destructive" aria-label={`Remover ${u.nome}`} onClick={() => remover(u.id, u.nome)}><Trash2 size={15} /></Button>
                  </div>
                </li>
              )
            })}
          </ul>
        </Panel>
      )}
      <Confirm copy={confirma?.copy ?? null} onClose={() => setConfirma(null)} onConfirm={() => update(s => { s.unidades = s.unidades.filter(a => a.id !== confirma?.id); s.feriados = s.feriados.filter(f => f[2] !== confirma?.id) })} />
    </div>
  )
}
