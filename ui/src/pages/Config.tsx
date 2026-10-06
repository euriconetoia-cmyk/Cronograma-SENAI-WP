import { useEffect, useRef, type ReactNode } from 'react'
import { Building2, CalendarOff, DatabaseBackup, KeyRound, UserCog, type LucideIcon } from 'lucide-react'
import { CONFIG_PAGES, useStore, type Page } from '@/lib/store'
import { T } from '@/lib/texts'

const ICONES: Partial<Record<Page, LucideIcon>> = { equipe: UserCog, acessos: KeyRound, unidades: Building2, feriados: CalendarOff, backup: DatabaseBackup }

/** Moldura das páginas de configuração: lista de seções à esquerda (em cima, no celular) e a página escolhida ao lado. */
export function ConfigLayout({ children }: { children: ReactNode }) {
  const { page, go } = useStore()
  const nav = useRef<HTMLElement>(null)
  useEffect(() => { nav.current?.querySelector('[aria-current]')?.scrollIntoView?.({ block: 'nearest', inline: 'center' }) }, [page])
  return (
    <div>
      <div className="mb-4">
        <h1 className="font-heading text-2xl font-semibold">{T.config.titulo}</h1>
        <p className="text-sm text-muted-foreground">{T.config.sub}</p>
      </div>
      <div className="grid gap-5 lg:grid-cols-[250px_1fr]">
        <nav ref={nav} aria-label="Seções de configuração" className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
          {CONFIG_PAGES.map(p => {
            const Ic = ICONES[p]!, it = T.config.itens[p as keyof typeof T.config.itens], ativo = page === p
            return (
              <a key={p} href={`#${p}`} onClick={e => { e.preventDefault(); go(p) }} aria-current={ativo ? 'page' : undefined}
                className={`ce-cfg-item flex min-w-[120px] shrink-0 items-start gap-3 rounded-xl border px-3.5 py-3 outline-none transition-all focus-visible:ring-2 focus-visible:ring-primary lg:min-w-0 ${ativo ? 'border-primary/40 bg-card text-foreground shadow-sm' : 'border-transparent text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
                <Ic size={20} className={`mt-0.5 shrink-0 transition-transform ${ativo ? 'text-primary' : ''}`} />
                <span><span className="block text-sm font-semibold">{it.nome}</span><span className="hidden text-xs leading-snug lg:block">{it.desc}</span></span>
              </a>
            )
          })}
        </nav>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  )
}
