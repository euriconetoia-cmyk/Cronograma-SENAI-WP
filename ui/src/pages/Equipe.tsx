import { useState } from 'react'
import { toast } from 'sonner'
import { Trash2, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Confirm, Empty, Panel, uid, type ConfirmCopy } from '@/components/Fields'
import { useStore } from '@/lib/store'
import { T } from '@/lib/texts'
import type { Papel } from '@/lib/types'

const PAPEIS: Papel[] = ['monitor', 'tutor', 'professor', 'coordenador']

export function EquipePage() {
  const { d, update } = useStore()
  const [nome, setNome] = useState('')
  const [papel, setPapel] = useState<Papel>('monitor')
  const [confirma, setConfirma] = useState<{ copy: ConfirmCopy; id: string } | null>(null)
  const add = () => {
    if (!nome.trim()) { toast(T.equipe.informeNome); return }
    update(x => { x.pessoas.push({ id: uid('p'), nome: nome.trim(), papel }) }); setNome(''); toast(T.equipe.adicionada)
  }
  return (
    <div className="flex flex-col gap-4">
      <Panel title={T.equipe.titulo}>
        <form className="flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); add() }}>
          <label className="flex min-w-[240px] flex-1 flex-col gap-1"><span className="kicker">{T.equipe.nome}</span><input className="field-input" value={nome} onChange={e => setNome(e.target.value)} /></label>
          <label className="flex flex-col gap-1"><span className="kicker">{T.equipe.papel}</span>
            <select className="field-input" value={papel} onChange={e => setPapel(e.target.value as Papel)}>{PAPEIS.map(p => <option key={p} value={p}>{T.equipe.papel1[p]}</option>)}</select></label>
          <Button type="submit"><UserPlus size={15} />{T.equipe.adicionar}</Button>
        </form>
      </Panel>
      {d.pessoas.length === 0 ? <Empty titulo={T.equipe.vazio.titulo} texto={T.equipe.vazio.texto} /> : (
        <div className="grid gap-4 md:grid-cols-2">
          {PAPEIS.map(p => {
            const lista = d.pessoas.filter(x => x.papel === p)
            return (
              <Panel key={p} title={`${T.equipe.papeis[p]} (${lista.length})`}>
                {lista.length === 0 ? <p className="text-sm text-muted-foreground">Ninguém cadastrado neste papel.</p> : (
                  <ul className="flex flex-col divide-y">
                    {lista.map(x => (
                      <li key={x.id} className="flex items-center gap-2 py-1">
                        <input aria-label={`Nome de ${x.nome}`} className="cell-input flex-1 text-sm" value={x.nome} onChange={e => update(s => { s.pessoas.find(a => a.id === x.id)!.nome = e.target.value })} />
                        <select aria-label={`Papel de ${x.nome}`} className="cell-input w-auto" value={x.papel} onChange={e => update(s => { s.pessoas.find(a => a.id === x.id)!.papel = e.target.value as Papel })}>{PAPEIS.map(q => <option key={q} value={q}>{T.equipe.papel1[q]}</option>)}</select>
                        <Button size="icon" variant="ghost" className="text-destructive" aria-label={`Remover ${x.nome}`} onClick={() => setConfirma({ copy: T.equipe.confirma(x.nome), id: x.id })}><Trash2 size={15} /></Button>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            )
          })}
        </div>
      )}
      <Confirm copy={confirma?.copy ?? null} onClose={() => setConfirma(null)} onConfirm={() => update(s => { s.pessoas = s.pessoas.filter(a => a.id !== confirma?.id) })} />
    </div>
  )
}
