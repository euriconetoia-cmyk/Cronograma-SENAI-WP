import { useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, Hourglass, MailWarning, MessageSquare, Unlock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { pedidoAberto, pedirAba, ROTULO_SUB } from '@/lib/avisos'
import { quando } from '@/lib/format'
import { acoesDisponiveis } from '@/lib/rules'
import { useStore } from '@/lib/store'
import type { Aviso, Turma } from '@/lib/types'

const abrirFluxo = (a: string) => window.dispatchEvent(new CustomEvent('ce-fluxo-abrir', { detail: a }))
const conversa = (avisos: Aviso[], id: string) => avisos.filter(a => a.turmaId === id && (a.tipo === 'pedido' || a.tipo === 'mensagem'))

/** Faixa que chama atenção dentro do cronograma: pedido aberto (Unidigit@l) ou resposta nova (unidade). */
export function FaixaPedidos({ t }: { t: Turma }) {
  const { me, avisos, lerAvisos, atenderPedido } = useStore()
  const lista = useMemo(() => conversa(avisos, t.id), [avisos, t.id])
  if (me.perfil === 'consulta') return null
  const abertos = lista.filter(pedidoAberto)
  const naoLidas = lista.filter(a => a.meu && !a.lido && a.tipo === 'mensagem')
  const podeReabrir = acoesDisponiveis(t.status, me.perfil, me.validador).includes('reabrir')
  const atender = async (id: number) => { try { await atenderPedido(id); toast('Pedido marcado como atendido.') } catch (e) { toast(e instanceof Error ? e.message : 'Não foi possível marcar.') } }

  if (me.perfil === 'equipe') {
    if (!abertos.length) return null
    return (
      <section aria-label="Pedidos da unidade" className="rounded-lg border-2 border-warn/60 bg-warn-soft p-3.5 text-warn">
        <h2 className="flex items-center gap-2 text-sm font-bold"><Hourglass size={16} />{abertos.length === 1 ? 'A unidade fez um pedido sobre este cronograma' : `A unidade fez ${abertos.length} pedidos sobre este cronograma`}</h2>
        <ul className="mt-2 flex flex-col gap-2">
          {abertos.map(a => (
            <li key={a.id} className="rounded-md bg-card p-3 text-foreground">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span className="rounded-full bg-warn-soft px-2 py-0.5 font-semibold text-warn">{ROTULO_SUB[a.subtipo] ?? 'Alteração'}</span><span>{a.de} · {quando(a.em)}</span></div>
              <p className="mt-1 whitespace-pre-wrap text-sm">{a.texto}</p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => abrirFluxo('comentar')}><MessageSquare size={14} />Responder</Button>
                {podeReabrir && <Button size="sm" variant="outline" onClick={() => abrirFluxo('reabrir')}><Unlock size={14} />Reabrir para alterar</Button>}
                <Button size="sm" variant="outline" onClick={() => void atender(a.id)}><CheckCircle2 size={14} />Marcar como atendido</Button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    )
  }
  if (naoLidas.length) {
    const u = naoLidas[0]
    return (
      <section aria-label="Resposta da Unidigit@l" className="rounded-lg border-2 border-primary/50 bg-primary/5 p-3.5">
        <h2 className="flex items-center gap-2 text-sm font-bold text-primary"><MessageSquare size={16} />{naoLidas.length === 1 ? 'Nova mensagem da Unidigit@l' : `${naoLidas.length} novas mensagens da Unidigit@l`}</h2>
        <p className="mt-1.5 line-clamp-3 whitespace-pre-wrap text-sm">{u.texto}</p>
        <p className="mt-1 text-xs text-muted-foreground">{u.de} · {quando(u.em)}</p>
        <div className="mt-2.5 flex flex-wrap gap-2"><Button size="sm" onClick={() => { pedirAba('msgs') }}>Ver conversa</Button><Button size="sm" variant="outline" onClick={() => void lerAvisos({ ids: naoLidas.map(x => x.id) })}>Marcar como lida</Button></div>
      </section>
    )
  }
  if (abertos.length) return (
    <section aria-label="Seu pedido" className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3.5 py-2.5 text-sm">
      <Hourglass size={16} className="shrink-0 text-warn" /><span className="flex-1"><b>Seu pedido foi enviado à Unidigit@l</b> e aguarda resposta. Você será avisado aqui e no sino.</span>
      <Button size="sm" variant="outline" onClick={() => pedirAba('msgs')}>Ver pedido</Button>
    </section>
  )
  return null
}

/** Aba "Mensagens": pedidos e respostas desta turma, em ordem, como uma conversa. */
export function AbaMensagens({ t }: { t: Turma }) {
  const { me, avisos, lerAvisos, atenderPedido } = useStore()
  const lista = useMemo(() => conversa(avisos, t.id).slice().reverse(), [avisos, t.id])
  const temNovas = lista.some(a => a.meu && !a.lido)
  useEffect(() => { if (temNovas) void lerAvisos({ turma: t.id }) }, [temNovas, t.id, lerAvisos])
  const equipe = me.perfil === 'equipe'
  const pode = acoesDisponiveis(t.status, me.perfil, me.validador).includes('comentar')
  const rotuloBtn = equipe ? 'Enviar mensagem à unidade' : t.status === 'validado' ? 'Pedir reabertura' : 'Pedir alteração à Unidigit@l'
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-prose text-sm text-muted-foreground">{equipe ? 'Pedidos da unidade e suas respostas ficam aqui. A unidade também é avisada por e-mail e pelo sino.' : 'Seus pedidos à Unidigit@l e as respostas ficam aqui. Você é avisado pelo sino e por e-mail.'}</p>
        {pode && <Button onClick={() => abrirFluxo('comentar')}><MessageSquare size={15} />{rotuloBtn}</Button>}
      </div>
      {lista.length === 0 && <div className="rounded-lg border border-dashed bg-card px-4 py-10 text-center text-sm text-muted-foreground">{equipe ? 'Nenhuma mensagem ainda. Quando a unidade pedir algo, o pedido aparece aqui.' : 'Nenhuma mensagem ainda. Precisa mudar algo que você não consegue ajustar sozinho? Use o botão acima.'}</div>}
      <ol className="flex flex-col gap-3">
        {lista.map(a => {
          const minha = equipe ? a.tipo === 'mensagem' : a.tipo === 'pedido'
          const aberto = pedidoAberto(a)
          return (
            <li key={a.id} className={`flex ${minha ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[min(92%,620px)] rounded-xl border p-3 ${minha ? 'bg-primary/10' : 'bg-card'} ${aberto && equipe ? 'border-warn/60' : ''}`}>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <b className="text-foreground">{a.de}</b><span>{quando(a.em)}</span>
                  {a.pedido && <span className="rounded-full bg-secondary px-2 py-0.5 font-semibold text-foreground">{ROTULO_SUB[a.subtipo] ?? 'Alteração'}</span>}
                  {a.pedido && (aberto ? <span className="rounded-full bg-warn-soft px-2 py-0.5 font-semibold text-warn">Aguardando resposta</span> : <span className="inline-flex items-center gap-1 rounded-full bg-ok-soft px-2 py-0.5 font-semibold text-ok"><CheckCircle2 size={11} />Atendido{a.atendidoPor ? ` por ${a.atendidoPor}` : ''}</span>)}
                  {equipe && a.emailOk === false && <span className="inline-flex items-center gap-1 text-destructive"><MailWarning size={11} />e-mail não enviado</span>}
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-sm">{a.texto}</p>
                {equipe && aberto && <div className="mt-2"><Button size="sm" variant="outline" onClick={() => void atenderPedido(a.id)}><CheckCircle2 size={14} />Marcar como atendido</Button></div>}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
