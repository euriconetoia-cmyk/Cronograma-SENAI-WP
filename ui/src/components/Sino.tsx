import { useState } from 'react'
import { AlertCircle, Bell, CheckCheck, CheckCircle2, Inbox, MailWarning, MessageSquare, Send, Unlock } from 'lucide-react'
import { useStore } from '@/lib/store'
import { useFora } from './useFora'
import { pedirAba, pedidoAberto, ROTULO_SUB } from '@/lib/avisos'
import { quando } from '@/lib/format'
import type { Aviso } from '@/lib/types'

export function iconeAviso(a: Aviso) {
  if (a.pedido) return a.subtipo === 'reabertura' ? Unlock : AlertCircle
  if (a.tipo === 'mensagem') return MessageSquare
  if (a.tipo === 'reabrir') return Unlock
  if (a.tipo === 'enviar') return Send
  return Inbox
}

/** Sino do cabeçalho: mostra o que chegou (pedidos, mensagens e andamento) e leva até a turma. */
export function Sino() {
  const { me, avisos, naoLidos, pedidosAbertos, lerAvisos, go, setTurmaId, d } = useStore()
  const [aberto, setAberto] = useState(false)
  const ref = useFora(aberto, () => setAberto(false))
  if (me.perfil === 'consulta') return null
  const equipe = me.perfil === 'equipe'
  const total = equipe ? naoLidos + 0 : naoLidos
  const abrir = (a: Aviso) => {
    if (a.meu && !a.lido) void lerAvisos({ ids: [a.id] })
    if (d.turmas.some(t => t.id === a.turmaId)) { setTurmaId(a.turmaId); go('cronograma'); pedirAba(a.tipo === 'pedido' || a.tipo === 'mensagem' ? 'msgs' : 'cronograma') }
    setAberto(false)
  }
  const rotulo = `Avisos${naoLidos ? `, ${naoLidos} ${naoLidos === 1 ? 'novo' : 'novos'}` : ''}${pedidosAbertos ? `, ${pedidosAbertos} ${pedidosAbertos === 1 ? 'pedido aberto' : 'pedidos abertos'}` : ''}`
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setAberto(v => !v)} aria-haspopup="dialog" aria-expanded={aberto} aria-label={rotulo} title={rotulo}
        className="relative grid h-10 w-10 place-items-center rounded-full text-muted-foreground outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary">
        <Bell size={20} className={total > 0 ? 'ce-sino text-foreground' : ''} />
        {total > 0 && <span className="mono absolute right-0.5 top-0.5 min-w-[18px] rounded-full bg-destructive px-1 text-center text-[11px] font-bold leading-[18px] text-white">{total > 99 ? '99+' : total}</span>}
      </button>
      {aberto && (
        <div role="dialog" aria-label="Avisos" className="ce-pop fixed inset-x-3 top-[60px] z-50 max-h-[75vh] overflow-hidden rounded-xl border bg-card shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[400px]">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <h2 className="font-heading text-sm font-semibold">Avisos</h2>
            {pedidosAbertos > 0 && <span className="rounded-full bg-warn-soft px-2 py-0.5 text-xs font-semibold text-warn">{pedidosAbertos} {pedidosAbertos === 1 ? 'pedido aberto' : 'pedidos abertos'}</span>}
            <span className="flex-1" />
            {naoLidos > 0 && <button type="button" onClick={() => void lerAvisos({ todos: true })} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-primary hover:bg-secondary"><CheckCheck size={14} />Marcar tudo como lido</button>}
          </div>
          <ul className="max-h-[calc(75vh-52px)] overflow-y-auto">
            {avisos.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhum aviso por aqui. Quando houver um pedido ou uma mensagem, ele aparece neste sino.</li>}
            {avisos.slice(0, 30).map(a => {
              const Ic = iconeAviso(a), novo = a.meu && !a.lido, aberto = pedidoAberto(a)
              return (
                <li key={a.id} className="border-b last:border-0">
                  <button type="button" onClick={() => abrir(a)} className={`flex w-full items-start gap-3 px-4 py-3 text-left outline-none hover:bg-secondary focus-visible:bg-secondary ${novo ? 'bg-primary/5' : ''}`}>
                    <Ic size={18} className={`mt-0.5 shrink-0 ${aberto ? 'text-warn' : 'text-muted-foreground'}`} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start gap-2"><span className={`flex-1 text-sm leading-snug ${novo ? 'font-semibold' : 'font-medium'}`}>{!a.meu && a.pedido ? `Seu pedido · ${ROTULO_SUB[a.subtipo] ?? 'Alteração'}` : a.titulo}</span>{novo && <span aria-label="Novo" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-destructive" />}</span>
                      {a.texto && <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{a.texto}</span>}
                      <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                        <span>{a.de} · {quando(a.em)}</span>
                        {a.pedido && (aberto ? <span className="rounded-full bg-warn-soft px-2 py-0.5 font-semibold text-warn">Aguardando resposta</span> : <span className="inline-flex items-center gap-1 rounded-full bg-ok-soft px-2 py-0.5 font-semibold text-ok"><CheckCircle2 size={11} />Atendido</span>)}
                        {equipe && a.emailOk === false && <span className="inline-flex items-center gap-1 text-destructive"><MailWarning size={11} />e-mail não enviado</span>}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
