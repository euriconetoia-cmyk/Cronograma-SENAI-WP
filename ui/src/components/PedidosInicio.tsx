import { ArrowRight, BellRing, CheckCircle2, Hourglass, MessageSquare } from 'lucide-react'
import { pedirAba, pedidoAberto, ROTULO_SUB } from '@/lib/avisos'
import { quando } from '@/lib/format'
import { useStore } from '@/lib/store'

/** Cartão do Início: o que as unidades pediram (Unidigit@l) ou o que a Unidigit@l respondeu (unidade). */
export function PedidosInicio() {
  const { me, avisos, d, go, setTurmaId, lerAvisos } = useStore()
  if (me.perfil === 'consulta') return null
  const equipe = me.perfil === 'equipe'
  const nome = (id: string) => d.turmas.find(t => t.id === id)?.nome || 'Turma'
  const unid = (id: string) => d.unidades.find(u => u.id === id)?.nome || ''
  const ir = (id: string, aba: string) => { setTurmaId(id); go('cronograma'); pedirAba(aba) }

  if (equipe) {
    const abertos = avisos.filter(pedidoAberto)
    if (!abertos.length) return null
    return (
      <section aria-label="Pedidos das unidades" className="ce-sobe rounded-2xl border-2 border-warn/60 bg-warn-soft p-4 text-warn">
        <h2 className="flex items-center gap-2 font-heading text-base font-bold"><BellRing size={18} />{abertos.length === 1 ? '1 pedido de unidade espera resposta' : `${abertos.length} pedidos de unidades esperam resposta`}</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {abertos.slice(0, 5).map(a => (
            <li key={a.id}>
              <button type="button" onClick={() => ir(a.turmaId, 'msgs')} className="flex w-full items-start gap-3 rounded-lg bg-card p-3 text-left text-foreground outline-none transition hover:-translate-y-0.5 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-primary">
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 text-xs"><span className="rounded-full bg-warn-soft px-2 py-0.5 font-semibold text-warn">{ROTULO_SUB[a.subtipo] ?? 'Alteração'}</span><span className="text-muted-foreground">{unid(a.unidadeId)} · {quando(a.em)}</span></span>
                  <span className="mt-1 block text-sm font-semibold">{nome(a.turmaId)}</span>
                  <span className="line-clamp-2 block text-sm text-muted-foreground">{a.texto}</span>
                </span>
                <ArrowRight size={16} className="mt-1 shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
        {abertos.length > 5 && <p className="mt-2 text-xs">E mais {abertos.length - 5}. Use o sino para ver todos.</p>}
      </section>
    )
  }
  const novas = avisos.filter(a => a.meu && !a.lido && a.tipo === 'mensagem')
  const meus = avisos.filter(a => a.pedido).slice(0, 3)
  if (!novas.length && !meus.some(pedidoAberto)) return null
  return (
    <section aria-label="Conversa com a Unidigit@l" className="ce-sobe rounded-2xl border-2 border-primary/40 bg-primary/5 p-4">
      <h2 className="flex items-center gap-2 font-heading text-base font-bold text-primary"><MessageSquare size={18} />{novas.length ? `${novas.length} ${novas.length === 1 ? 'resposta nova' : 'respostas novas'} da Unidigit@l` : 'Seus pedidos'}</h2>
      <ul className="mt-3 flex flex-col gap-2">
        {novas.slice(0, 4).map(a => (
          <li key={a.id}><button type="button" onClick={() => { void lerAvisos({ ids: [a.id] }); ir(a.turmaId, 'msgs') }} className="flex w-full items-start gap-3 rounded-lg bg-card p-3 text-left outline-none hover:shadow-sm focus-visible:ring-2 focus-visible:ring-primary">
            <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{nome(a.turmaId)}</span><span className="line-clamp-2 block text-sm text-muted-foreground">{a.texto}</span><span className="text-xs text-muted-foreground">{a.de} · {quando(a.em)}</span></span><ArrowRight size={16} className="mt-1 shrink-0 text-muted-foreground" />
          </button></li>
        ))}
        {meus.map(a => (
          <li key={`m${a.id}`} className="flex items-center gap-2 rounded-lg bg-card px-3 py-2 text-sm"><span className="min-w-0 flex-1 truncate"><b>{ROTULO_SUB[a.subtipo] ?? 'Pedido'}</b> · {nome(a.turmaId)}</span>
            {pedidoAberto(a) ? <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-warn-soft px-2 py-0.5 text-xs font-semibold text-warn"><Hourglass size={11} />Aguardando</span> : <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-ok-soft px-2 py-0.5 text-xs font-semibold text-ok"><CheckCircle2 size={11} />Atendido</span>}</li>
        ))}
      </ul>
    </section>
  )
}
