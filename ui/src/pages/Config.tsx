import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Building2, CalendarOff, ChevronLeft, ChevronRight, DatabaseBackup, KeyRound, UserCog, type LucideIcon } from 'lucide-react'
import { CONFIG_PAGES, useStore, type Page } from '@/lib/store'
import { T } from '@/lib/texts'

const ICONES: Partial<Record<Page, LucideIcon>> = { equipe: UserCog, acessos: KeyRound, unidades: Building2, feriados: CalendarOff, backup: DatabaseBackup }

/** Moldura das páginas de configuração: lista de seções à esquerda (em cima, no celular) e a página escolhida ao lado. */
export function ConfigLayout({ children }: { children: ReactNode }) {
  const { page, go } = useStore()
  const nav = useRef<HTMLElement>(null)
  const [recolhida, setRecolhida] = useState(() => window.localStorage.getItem('ce-config-sidebar') === 'collapsed')
  useEffect(() => { nav.current?.querySelector('[aria-current]')?.scrollIntoView?.({ block: 'nearest', inline: 'center' }) }, [page])
  useEffect(() => { window.localStorage.setItem('ce-config-sidebar', recolhida ? 'collapsed' : 'expanded') }, [recolhida])
  return (
    <div>
      <div className="mb-4">
        <h1 className="font-heading text-2xl font-semibold">{T.config.titulo}</h1>
        <p className="text-sm text-muted-foreground">{T.config.sub}</p>
      </div>
      <div className={`grid gap-5 transition-[grid-template-columns] duration-300 ease-out ${recolhida ? 'lg:grid-cols-[76px_minmax(0,1fr)]' : 'lg:grid-cols-[250px_minmax(0,1fr)]'}`}>
        <aside className="relative min-w-0">
          <nav ref={nav} aria-label="Seções de configuração"
            className={`flex gap-2 overflow-x-auto lg:sticky lg:top-4 lg:flex-col lg:overflow-visible lg:rounded-2xl lg:border lg:bg-card/70 lg:p-2 lg:shadow-sm lg:backdrop-blur-sm transition-all duration-300 ${recolhida ? 'lg:items-center' : ''}`}>
            {CONFIG_PAGES.map(p => {
              const Ic = ICONES[p]!, it = T.config.itens[p as keyof typeof T.config.itens], ativo = page === p
              return (
                <a key={p} href={`#${p}`} onClick={e => { e.preventDefault(); go(p) }} aria-current={ativo ? 'page' : undefined}
                  title={recolhida ? `${it.nome} — ${it.desc}` : undefined}
                  className={`ce-cfg-item group relative flex min-w-[120px] shrink-0 items-start gap-3 rounded-xl border outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary lg:min-w-0 ${recolhida ? 'lg:h-12 lg:w-12 lg:items-center lg:justify-center lg:px-0 lg:py-0' : 'px-3.5 py-3'} ${ativo ? 'border-primary/40 bg-accent text-foreground shadow-sm' : 'border-transparent text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
                  <Ic size={20} className={`shrink-0 transition-all duration-200 ${recolhida ? 'lg:m-0 lg:scale-105' : 'mt-0.5'} ${ativo ? 'text-primary' : ''}`} />
                  <span className={`transition-all duration-200 ${recolhida ? 'lg:pointer-events-none lg:absolute lg:w-0 lg:overflow-hidden lg:opacity-0' : 'lg:opacity-100'}`}>
                    <span className="block whitespace-nowrap text-sm font-semibold">{it.nome}</span>
                    <span className="hidden text-xs leading-snug lg:block">{it.desc}</span>
                  </span>
                  {ativo && recolhida && <span aria-hidden="true" className="absolute -left-2 hidden h-6 w-1 rounded-full bg-primary lg:block" />}
                </a>
              )
            })}
          </nav>
          <button type="button"
            onClick={() => setRecolhida(v => !v)}
            className="absolute -right-3 top-5 z-20 hidden h-7 w-7 items-center justify-center rounded-full border bg-card text-muted-foreground shadow-md transition-all hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:flex"
            aria-label={recolhida ? 'Expandir menu de configurações' : 'Recolher menu de configurações'}
            title={recolhida ? 'Expandir menu' : 'Recolher menu'}>
            {recolhida ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </aside>
        <div className="min-w-0 transition-all duration-300">{children}</div>
      </div>
    </div>
  )
}
