import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Archive, Check, FolderOpen, MessageSquare, Play, RotateCcw, Send, Undo2, Unlock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ApiError } from '@/lib/api'
import { acoesDisponiveis } from '@/lib/rules'
import { dataBr, quando } from '@/lib/format'
import { pedidoAberto, ROTULO_SUB } from '@/lib/avisos'
import { useStore } from '@/lib/store'
import { T } from '@/lib/texts'
import type { AcaoNome, SubtipoPedido, Turma } from '@/lib/types'
import { StatusBadge } from './Status'

const ICONE: Record<AcaoNome, typeof Send> = { iniciar: Play, enviar: Send, recolher: Undo2, validar: Check, reabrir: Unlock, arquivar: Archive, restaurar: RotateCcw, comentar: MessageSquare }
const PRINCIPAL: AcaoNome[] = ['iniciar', 'enviar', 'validar']

function somarUteis(d: Date, n: number) { const t = new Date(d); while (n > 0) { t.setDate(t.getDate() + 1); const w = t.getDay(); if (w !== 0 && w !== 6) n-- } return t }
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function FluxoBar({ t, bloqueios }: { t: Turma; bloqueios: number }) {
  const { d, me, acao, pendentes, salvarAjustes, descartar, avisos } = useStore()
  const [dlg, setDlg] = useState<AcaoNome | 'salvar' | null>(null)
  const [motivo, setMotivo] = useState('')
  const [ressalva, setRessalva] = useState('')
  const [prazo, setPrazo] = useState('')
  const [erro, setErro] = useState('')
  const [tipo, setTipo] = useState<SubtipoPedido>('alteracao')
  const [atende, setAtende] = useState(true)
  const abertos = avisos.filter(a => a.turmaId === t.id && pedidoAberto(a)).length
  const [busy, setBusy] = useState(false)

  const unidade = d.unidades.find(u => u.id === t.unidadeId)?.nome || ''
  const sujo = pendentes.includes(t.id)
  const prazoBr = dataBr(t.prazo)
  const v = t.vigente
  const M = T.fluxo.msg
  const msg = me.perfil === 'consulta' ? M.consulta
    : me.perfil === 'equipe'
      ? t.status === 'solicitado' ? M.equipe.solicitado(unidade) : t.status === 'elaboracao' ? M.equipe.elaboracao() : t.status === 'validacao' ? M.equipe.validacao(unidade, prazoBr)
        : t.status === 'validado' ? M.equipe.validado(v?.versao ?? t.versao, v?.por || '', quando(v?.em).slice(0, 10)) : M.equipe.arquivado()
      : t.status === 'solicitado' ? M.unidade.solicitado() : t.status === 'elaboracao' ? M.unidade.elaboracao() : t.status === 'validacao' ? M.unidade.validacao(prazoBr)
        : t.status === 'validado' ? M.unidade.validado(v?.versao ?? t.versao, v?.por || '', quando(v?.em).slice(0, 10)) : M.unidade.arquivado()

  const acoes = acoesDisponiveis(t.status, me.perfil, me.validador).filter(a => a !== 'comentar')
  const podeComentar = acoesDisponiveis(t.status, me.perfil, me.validador).includes('comentar')
  const copy = (a: AcaoNome) => (a === 'comentar' ? (me.perfil === 'unidade' ? { ...T.fluxo.acoes.comentarUnidade, ...(t.status === 'validado' ? { rotulo: 'Pedir reabertura' } : {}) } : T.fluxo.acoes.comentarEquipe) : T.fluxo.acoes[a])

  const abrir = (a: AcaoNome | 'salvar') => {
    setErro(''); setMotivo(''); setRessalva(''); setTipo(t.status === 'validado' ? 'reabertura' : 'alteracao'); setAtende(true)
    if (a === 'enviar') setPrazo(iso(somarUteis(new Date(), me.prazoDias || 5)))
    setDlg(a)
  }
  const fechar = () => { if (!busy) setDlg(null) }
  // Outros pontos da tela (ex.: "Dados da turma") podem pedir para abrir uma ação do fluxo.
  useEffect(() => {
    const h = (ev: Event) => {
      const a = (ev as CustomEvent<string>).detail as AcaoNome
      if (acoesDisponiveis(t.status, me.perfil, me.validador).includes(a)) abrir(a)
    }
    window.addEventListener('ce-fluxo-abrir', h)
    return () => window.removeEventListener('ce-fluxo-abrir', h)
  }) // eslint-disable-line react-hooks/exhaustive-deps

  const confirmar = async () => {
    if (!dlg) return
    setBusy(true); setErro('')
    try {
      if (dlg === 'salvar') { await salvarAjustes(t.id, motivo.trim()); toast(T.fluxo.ajustes.salvos); setDlg(null); return }
      await acao(t.id, { acao: dlg, motivo: motivo.trim(), ressalva: ressalva.trim(), prazo: dlg === 'enviar' ? prazo : undefined, tipo: dlg === 'comentar' && me.perfil === 'unidade' ? tipo : undefined, atende: dlg === 'comentar' && me.perfil === 'equipe' ? atende && abertos > 0 : undefined })
      toast(T.fluxo.feito[dlg]); setDlg(null)
    } catch (e) { setErro(e instanceof ApiError || e instanceof Error ? e.message : 'Não foi possível concluir.') } finally { setBusy(false) }
  }

  const c = dlg && dlg !== 'salvar' ? copy(dlg) as { titulo: string; texto: string; ok: string; motivo?: string; ressalva?: string; ressalvaDica?: string; motivoEquipe?: string } : null
  const motivoRotulo = dlg === 'validar' && me.perfil === 'equipe' ? T.fluxo.acoes.validar.motivoEquipe : c?.motivo
  const motivoObrig = dlg === 'comentar' || dlg === 'recolher' || dlg === 'reabrir' || dlg === 'arquivar' || (dlg === 'validar' && me.perfil === 'equipe')
  const bloqueadoEnvio = dlg === 'enviar' && bloqueios > 0
  const faltaMotivo = motivoObrig && !motivo.trim()

  return (
    <div className="rounded-lg border bg-card p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><StatusBadge status={t.status} versao={t.versao} />
            {t.status === 'validacao' && t.vigente && <span className="text-xs text-muted-foreground">{T.fluxo.reaberta(t.versao, t.vigente.versao)}</span>}</div>
          <p className="mt-1.5 max-w-prose text-sm">{msg}</p>
          {v?.ressalva && <p className="mt-1 text-xs text-warn">Ressalva da unidade: {v.ressalva}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {podeComentar && <Button variant="ghost" onClick={() => abrir('comentar')}><MessageSquare size={15} />{copy('comentar').rotulo}</Button>}
          {acoes.map(a => {
            const I = ICONE[a]
            return <Button key={a} variant={PRINCIPAL.includes(a) ? 'default' : 'outline'} disabled={a === 'validar' && sujo} title={a === 'validar' && sujo ? T.fluxo.ajustes.salveAntes : undefined} onClick={() => abrir(a)}><I size={15} />{T.fluxo.acoes[a].rotulo}</Button>
          })}
        </div>
      </div>
      {sujo && me.perfil === 'unidade' && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-warn/40 bg-warn-soft px-3 py-2 text-sm text-warn" role="status">
          <FolderOpen size={15} /><span className="flex-1">{T.fluxo.ajustes.sujo}</span>
          <Button size="sm" onClick={() => abrir('salvar')}>{T.fluxo.ajustes.salvar}</Button>
          <Button size="sm" variant="outline" onClick={() => void descartar(t.id).then(() => toast(T.fluxo.ajustes.descartados))}>{T.fluxo.ajustes.descartar}</Button>
        </div>
      )}

      <Dialog open={!!dlg} onOpenChange={o => { if (!o) fechar() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dlg === 'salvar' ? T.fluxo.ajustes.tituloSalvar : c?.titulo}</DialogTitle>
            <DialogDescription>{dlg === 'salvar' ? 'A Unidigit@l vê o que você mudou, com a data e o motivo.' : c?.texto}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            {dlg === 'enviar' && (
              <>
                <label className="flex flex-col gap-1"><span className="kicker">{T.fluxo.prazo}</span><input type="date" className="field-input w-auto" value={prazo} onChange={e => setPrazo(e.target.value)} /><span className="text-xs text-muted-foreground">{T.fluxo.prazoDica}</span></label>
                {bloqueadoEnvio && <p role="alert" className="rounded-md bg-bad-soft px-3 py-2 text-sm text-destructive">{T.fluxo.bloqueioEnvio(bloqueios)}</p>}
              </>
            )}
            {dlg === 'comentar' && me.perfil === 'unidade' && (
              <label className="flex flex-col gap-1"><span className="kicker">O que você precisa?</span>
                <select className="field-input w-auto" value={tipo} onChange={e => setTipo(e.target.value as SubtipoPedido)}>
                  {(['alteracao', ...(t.status === 'validado' ? ['reabertura'] : []), 'duvida'] as SubtipoPedido[]).map(k => <option key={k} value={k}>{k === 'alteracao' ? 'Alterar algo que não consigo ajustar' : k === 'reabertura' ? 'Reabrir o cronograma validado' : 'Tirar uma dúvida'}</option>)}
                </select>
                <span className="text-xs text-muted-foreground">{ROTULO_SUB[tipo]}: a Unidigit@l vê o pedido no sino e no Início, e você acompanha a resposta aqui.</span></label>
            )}
            {(dlg === 'salvar' || motivoRotulo) && (
              <label className="flex flex-col gap-1"><span className="kicker">{dlg === 'salvar' ? T.fluxo.ajustes.motivo : motivoRotulo}</span>
                <textarea className="field-input min-h-[84px]" value={motivo} onChange={e => setMotivo(e.target.value)} /></label>
            )}
            {dlg === 'comentar' && me.perfil === 'equipe' && abertos > 0 && (
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={atende} onChange={e => setAtende(e.target.checked)} />Marcar {abertos === 1 ? 'o pedido em aberto' : `os ${abertos} pedidos em aberto`} desta turma como atendido{abertos === 1 ? '' : 's'}</label>
            )}
            {dlg === 'validar' && (
              <label className="flex flex-col gap-1"><span className="kicker">{T.fluxo.acoes.validar.ressalva}</span>
                <textarea className="field-input min-h-[64px]" value={ressalva} onChange={e => setRessalva(e.target.value)} /><span className="text-xs text-muted-foreground">{T.fluxo.acoes.validar.ressalvaDica}</span></label>
            )}
            {erro && <p role="alert" className="rounded-md bg-bad-soft px-3 py-2 text-sm text-destructive">{erro}</p>}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={fechar} disabled={busy}>{T.geral.cancelar}</Button>
            <Button onClick={() => void confirmar()} disabled={busy || bloqueadoEnvio || faltaMotivo}>{dlg === 'salvar' ? T.fluxo.ajustes.salvar : c?.ok}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
