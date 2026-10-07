import { useState } from 'react'
import { toast } from 'sonner'
import { Building2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Confirm, Empty, Panel, uid, type ConfirmCopy } from '@/components/Fields'
import { useStore } from '@/lib/store'
import { T } from '@/lib/texts'

export function UnidadesPage() {
  const { d, update } = useStore()
  const [nome, setNome] = useState('')
  const [cidade, setCidade] = useState('')
  const [estado, setEstado] = useState('GO')
  const [confirma, setConfirma] = useState<{ copy: ConfirmCopy; id: string } | null>(null)
  const add = () => {
    if (!nome.trim()) { toast(T.unidades.informeNome); return }
    if (!estado) { toast('Informe o estado da unidade.'); return }
    update(x => { x.unidades.push({ id: uid('u'), nome: nome.trim(), cidade: cidade.trim(), estado }) }); setNome(''); setCidade(''); setEstado('GO'); toast(T.unidades.adicionada)
  }
  const remover = (id: string, n: string) => {
    if (d.turmas.some(t => t.unidadeId === id)) { toast(T.unidades.emUso); return }
    setConfirma({ copy: T.unidades.confirma(n), id })
  }
  return (
    <div className="flex flex-col gap-4">
      <Panel title={T.unidades.titulo}>
        <p className="mb-3 max-w-prose text-sm text-muted-foreground">{T.unidades.ajuda}</p>
        <form className="flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); add() }}>
          <label className="flex min-w-[240px] flex-1 flex-col gap-1"><span className="kicker">{T.unidades.nome}</span><input className="field-input" value={nome} onChange={e => setNome(e.target.value)} /></label>
          <label className="flex min-w-[180px] flex-col gap-1"><span className="kicker">{T.unidades.cidade}</span><input className="field-input" value={cidade} onChange={e => setCidade(e.target.value)} /></label>
          <label className="flex min-w-[130px] flex-col gap-1"><span className="kicker">Estado</span><select className="field-input" value={estado} onChange={e => setEstado(e.target.value)}>{['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(uf => <option key={uf}>{uf}</option>)}</select></label>
          <Button type="submit"><Building2 size={15} />{T.unidades.adicionar}</Button>
        </form>
      </Panel>
      {d.unidades.length === 0 ? <Empty titulo={T.unidades.vazio.titulo} texto={T.unidades.vazio.texto} /> : (
        <Panel>
          <ul className="flex flex-col divide-y">
            {d.unidades.map(u => {
              const n = d.turmas.filter(t => t.unidadeId === u.id).length
              return (
                <li key={u.id} className="flex flex-wrap items-center gap-2 py-1.5">
                  <input aria-label={`Nome da unidade ${u.nome}`} className="cell-input min-w-[200px] flex-1 text-sm" value={u.nome} onChange={e => update(s => { s.unidades.find(a => a.id === u.id)!.nome = e.target.value })} />
                  <input aria-label={`Cidade de ${u.nome}`} className="cell-input w-48 text-sm" placeholder="Cidade" value={u.cidade || ''} onChange={e => update(s => { s.unidades.find(a => a.id === u.id)!.cidade = e.target.value })} />
                  <select aria-label={`Estado de ${u.nome}`} className="cell-input w-24 text-sm" value={u.estado || ''} onChange={e => update(s => { s.unidades.find(a => a.id === u.id)!.estado = e.target.value })}><option value="">UF</option>{['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(uf => <option key={uf}>{uf}</option>)}</select>
                  <span className="mono w-20 text-right text-xs text-muted-foreground">{n} {n === 1 ? 'turma' : 'turmas'}</span>
                  <Button size="icon" variant="ghost" className="text-destructive" aria-label={`Remover ${u.nome}`} onClick={() => remover(u.id, u.nome)}><Trash2 size={15} /></Button>
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
