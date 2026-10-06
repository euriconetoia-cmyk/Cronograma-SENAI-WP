import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useStore } from '@/lib/store'
import type { Papel } from '@/lib/types'
import { T } from '@/lib/texts'

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="kicker">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  )
}

export function Panel({ title, actions, children, className = '' }: { title?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 rounded-lg border bg-card p-4 shadow-sm ${className}`}>
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-lg font-semibold">{title}</h2>}
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

/** Seção recolhível: fechada mostra um resumo. No celular só a primeira abre sozinha; no computador, todas. */
export function Secao({ titulo, resumo, children, aberta }: { titulo: string; resumo?: string; children: ReactNode; aberta?: boolean }) {
  const [a, setA] = useState(() => aberta ?? (typeof window !== 'undefined' && window.innerWidth >= 768))
  return (
    <section className="rounded-lg border">
      <button type="button" onClick={() => setA(v => !v)} aria-expanded={a} className="flex min-h-[48px] w-full items-center justify-between gap-3 rounded-lg px-4 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary">
        <span className="min-w-0"><span className="block font-heading text-[15px] font-semibold">{titulo}</span>{!a && resumo && <span className="block truncate text-xs text-muted-foreground">{resumo}</span>}</span>
        <ChevronDown size={18} className={`shrink-0 text-muted-foreground transition-transform ${a ? 'rotate-180' : ''}`} />
      </button>
      {a && <div className="border-t px-4 pb-4 pt-3">{children}</div>}
    </section>
  )
}

export function Empty({ titulo, texto, acao, onAcao }: { titulo: string; texto: string; acao?: string; onAcao?: () => void }) {
  return (
    <div className="rounded-lg border border-dashed bg-card/60 p-8">
      <h3 className="text-base font-semibold">{titulo}</h3>
      <p className="mt-1 max-w-prose text-sm text-muted-foreground">{texto}</p>
      {acao && <Button className="mt-4" onClick={onAcao}>{acao}</Button>}
    </div>
  )
}

export function PessoaSelect({ papel, value, onChange, padrao, className = 'cell-input', disabled }: { papel: Papel; value?: string; onChange: (v: string) => void; padrao?: string; className?: string; disabled?: boolean }) {
  const { d } = useStore()
  const pessoas = d.pessoas.filter(p => p.papel === papel)
  return (
    <select className={className} disabled={disabled} value={value || ''} onChange={e => onChange(e.target.value)} aria-label={T.equipe.papel1[papel]}>
      <option value="">{padrao ? T.cron.padrao(padrao) : T.geral.nenhum}</option>
      {pessoas.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
    </select>
  )
}

export interface ConfirmCopy { titulo: string; texto: string; ok: string; voltar: string }
export function Confirm({ copy, onConfirm, onClose }: { copy: ConfirmCopy | null; onConfirm: () => void; onClose: () => void }) {
  return (
    <Dialog open={!!copy} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy?.titulo}</DialogTitle>
          <DialogDescription>{copy?.texto}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>{copy?.voltar}</Button>
          <Button variant="destructive" onClick={() => { onConfirm(); onClose() }}>{copy?.ok}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 8)}`
export const pessoaNome = (d: { pessoas: { id: string; nome: string }[] }, id?: string) => d.pessoas.find(p => p.id === id)?.nome || ''

/** Copia texto com alternativa quando o navegador bloqueia a área de transferência. */
export async function copiar(texto: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(texto); return true } catch { /* tenta alternativa */ }
  try { const ta = document.createElement('textarea'); ta.value = texto; document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); document.body.removeChild(ta); return ok } catch { return false }
}
