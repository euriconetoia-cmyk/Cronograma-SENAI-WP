import { useState } from 'react'
import { toast } from 'sonner'
import { BookPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { uid } from '@/components/Fields'
import { useStore } from '@/lib/store'
import type { Curso, Turma } from '@/lib/types'

/** Turma pediu um curso que ainda não existe no cadastro: a Unidigit@l cadastra (ou escolhe um existente). */
export function CursoPendente({ t }: { t: Turma }) {
  const { me, d, update, flush, go, setCursoId } = useStore()
  const [escolha, setEscolha] = useState('')
  const [busy, setBusy] = useState(false)
  if (t.cursoId || !t.cursoSolicitado) return null
  const nome = t.cursoSolicitado

  if (me.perfil !== 'equipe') {
    return (
      <section aria-label="Curso pedido" className="rounded-lg border bg-card p-3.5 text-sm">
        <p className="flex items-start gap-2"><BookPlus size={16} className="mt-0.5 shrink-0 text-warn" /><span>Você pediu o curso <b>{nome}</b>, que ainda não está cadastrado. A Unidigit@l vai cadastrá-lo e avisar você quando o cronograma estiver pronto.</span></p>
      </section>
    )
  }
  const cadastrar = async () => {
    setBusy(true)
    try {
      const n: Curso = { id: uid('c'), nome, categoria: '', modalidade: '', chTotal: 0, nota: '', regras: { hEncontro: 8, webDias: 10, webHora: '15h', postDias: 3, horario: '08:00h às 17:00h' }, modulos: [{ id: uid('m'), nome: 'Módulo 1', itens: [] }] }
      update(x => { x.cursos.push(n) })
      await flush() // o curso precisa estar salvo antes de a turma apontar para ele
      update(x => { const tt = x.turmas.find(a => a.id === t.id); if (tt) tt.cursoId = n.id })
      setCursoId(n.id); toast(`Curso “${nome}” cadastrado. Complete as unidades curriculares dele.`); go('cursos')
    } catch (e) { toast(e instanceof Error ? e.message : 'Não foi possível cadastrar o curso.') } finally { setBusy(false) }
  }
  const usar = () => { if (!escolha) return; update(x => { const tt = x.turmas.find(a => a.id === t.id); if (tt) tt.cursoId = escolha }); toast('Curso vinculado à turma.') }
  return (
    <section aria-label="Curso pedido pela unidade" className="rounded-lg border-2 border-warn/60 bg-warn-soft p-3.5 text-warn">
      <h2 className="flex items-center gap-2 text-sm font-bold"><BookPlus size={16} />A unidade pediu um curso que não está cadastrado</h2>
      <p className="mt-1 text-sm text-foreground">Curso pedido: <b>{nome}</b>. Para iniciar a turma, cadastre este curso ou escolha um que já existe.</p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <Button onClick={() => void cadastrar()} disabled={busy}><BookPlus size={15} />Cadastrar “{nome.length > 30 ? nome.slice(0, 30) + '…' : nome}”</Button>
        <span className="text-xs text-muted-foreground">ou</span>
        <label className="flex flex-col gap-1"><span className="sr-only">Usar um curso já cadastrado</span>
          <select className="field-input !min-h-[40px] w-auto min-w-[220px]" value={escolha} onChange={e => setEscolha(e.target.value)} aria-label="Usar um curso já cadastrado">
            <option value="">Usar um curso já cadastrado…</option>
            {d.cursos.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select></label>
        <Button variant="outline" onClick={usar} disabled={!escolha}>Usar este curso</Button>
      </div>
    </section>
  )
}
