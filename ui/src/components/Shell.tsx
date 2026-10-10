import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Sino } from './Sino'
import { useFora } from './useFora'
import { BookOpen, CalendarDays, Ellipsis, LayoutDashboard, LogOut, Moon, Settings, Sun, UserCog, Users, type LucideIcon } from 'lucide-react'
import logoBranco from '@/assets/senai-logo-branco.png?inline'
import { config } from '@/lib/api'
import { root } from '@/lib/root'
import { trocarUsuario, USUARIOS, usuarioAtual } from '@/lib/mock'
import { CONFIG_PAGES, useStore, type Page } from '@/lib/store'
import { T } from '@/lib/texts'

export function Shell({ children }: { children: ReactNode }) {
  const { page, go: goBase, d, me, pages, salvo, api, recarregar, setCronAberto } = useStore()
  // "Cronogramas" no menu sempre leva à lista; escolher uma turma é que abre o cronograma.
  const go = (p: Page) => { if (p === 'cronograma') setCronAberto(false); goBase(p) }
  const [dark, setDark] = useState(() => { const ht = document.documentElement.getAttribute('data-theme'); if (ht) return ht === 'dark'; try { return localStorage.getItem('ce-dark') === '1' || (localStorage.getItem('ce-dark') === null && window.matchMedia('(prefers-color-scheme: dark)').matches) } catch { return false } })
  const wp = !!config()
  useEffect(() => { root.el?.classList.toggle('dark', dark); if (!wp) { try { localStorage.setItem('ce-dark', dark ? '1' : '0') } catch { /* ok */ } } }, [dark, wp])
  // No WordPress, quem manda é o botão do tema.
  useEffect(() => {
    if (!wp) return
    const f = () => setDark(document.documentElement.getAttribute('data-theme') === 'dark' || (!document.documentElement.getAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches))
    f(); const o = new MutationObserver(f); o.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] }); return () => o.disconnect()
  }, [wp])
  const abertas = d.turmas.filter(t => t.status === 'validacao').length
  const count: Partial<Record<string, number>> = { turmas: d.turmas.filter(t => t.status !== 'arquivado').length, cursos: d.cursos.length, equipe: d.pessoas.length, unidades: d.unidades.length }
  const logout = config()?.logout
  const validar = me.perfil === 'unidade' ? abertas : 0
  // Hora do último salvamento ("Salvo 14:32"): só muda quando o estado volta a "ok".
  const [hora, setHora] = useState('')
  const antes = useRef(salvo)
  useEffect(() => { if (salvo === 'ok' && antes.current !== 'ok') setHora(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })); antes.current = salvo }, [salvo])
  const estado = salvo === 'ok' ? (hora ? `${T.geral.salvo} ${hora}` : T.geral.salvo) : { sujo: T.geral.sujo, salvando: T.geral.salvando, erro: T.geral.erro }[salvo]
  const lupa = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType !== 'mouse') return
    e.currentTarget.querySelectorAll<HTMLElement>('a').forEach(a => { const r = a.getBoundingClientRect(); const s = 1 + Math.max(0, 1 - Math.abs(e.clientX - (r.left + r.width / 2)) / 110) * 0.18; a.style.transform = `scale(${s.toFixed(3)})` })
  }
  const soltaLupa = (e: React.PointerEvent<HTMLElement>) => e.currentTarget.querySelectorAll<HTMLElement>('a').forEach(a => { a.style.transform = '' })
  const entradas = entradasMenu(pages)
  const emConfig = CONFIG_PAGES.includes(page as Page)
  const atual = emConfig ? 'config' : page
  return (
    <div className="min-h-screen">
      <a href="#conteudo-principal" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-card focus:px-4 focus:py-2 focus:text-foreground focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary">Pular para o conteúdo principal</a>
      {api.mock && (
        <div className="bg-warn-soft px-4 py-1.5 text-xs text-warn">
          <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-3 gap-y-1">
            <b className="font-heading uppercase tracking-wide">Prévia do fluxo</b>
            <span>Os dados ficam só nesta janela. Escolha quem está usando o sistema:</span>
            <select aria-label="Ver como" className="rounded-sm border border-warn/40 bg-card px-2 py-0.5 text-foreground" value={usuarioAtual()} onChange={e => { trocarUsuario(e.target.value); void recarregar() }}>
              {Object.entries(USUARIOS).map(([k, u]) => <option key={k} value={k}>{u.rotulo}</option>)}
            </select>
          </div>
        </div>
      )}
      <header className="border-b bg-card">
        <div className="mx-auto flex h-14 max-w-[1500px] items-center gap-3 px-4">
          <a href={`#${entradas[0] ?? 'inicio'}`} onClick={e => { e.preventDefault(); go((entradas[0] ?? 'inicio') as Page) }} className="flex shrink-0 items-center rounded-md bg-brand px-2.5 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label={`SENAI · ${T.app.nome}`}>
            <img src={logoBranco} alt="SENAI" className="h-6 w-auto" />
          </a>
          <span className="font-heading text-base font-semibold leading-tight max-lg:hidden">{T.app.nome}</span>
          <nav aria-label="Seções" className="ce-dock ml-2 hidden items-end gap-1 rounded-2xl bg-secondary/70 px-2 py-1 lg:flex" onPointerMove={lupa} onPointerLeave={soltaLupa}>
            {entradas.map(p => <ItemTopo key={p} p={p} ativo={atual === p} n={p === 'turmas' && validar > 0 ? validar : count[p]} aviso={p === 'turmas' && validar > 0} go={go} />)}
          </nav>
          <span className="font-heading text-base font-semibold lg:hidden">{T.nav[atual as keyof typeof T.nav]}</span>
          <span className="flex-1" />
          <span role="status" className={`hidden items-center gap-1.5 text-xs sm:inline-flex ${salvo === 'erro' ? 'font-semibold text-destructive' : 'text-muted-foreground'}`}>
            <span aria-hidden="true" className={`h-2 w-2 rounded-full ${salvo === 'erro' ? 'bg-destructive' : salvo === 'ok' ? 'bg-ok' : 'bg-warn animate-pulse'}`} />{estado}
          </span>
          <Sino />
          <MenuUsuario me={me} dark={dark} setDark={setDark} wp={wp} logout={logout} estado={estado} salvo={salvo} />
        </div>
      </header>
      <main id="conteudo-principal" tabIndex={-1} key={page} className="ce-pagina mx-auto max-w-[1500px] px-4 pb-28 pt-5 lg:pb-16">{children}</main>
      <BarraInferior entradas={entradas} atual={atual} count={count} validar={validar} go={go} page={page} />
    </div>
  )
}

const ICONES: Record<string, LucideIcon> = { inicio: LayoutDashboard, cronograma: CalendarDays, turmas: Users, cursos: BookOpen, equipe: UserCog, config: Settings }
/** Última página de Configurações visitada: "Configurações" volta para ela. */
let ultimaConfig: Page = 'acessos'

function entradasMenu(pages: string[]) {
  // Configurações reúne várias páginas num só item do menu.
  return [...pages.filter(p => !CONFIG_PAGES.includes(p as Page)), ...(pages.some(p => CONFIG_PAGES.includes(p as Page)) ? ['config'] : [])]
}
const destino = (p: string): Page => (p === 'config' ? ultimaConfig : (p as Page))

function ItemTopo({ p, ativo, n, aviso, go }: { p: string; ativo: boolean; n?: number; aviso: boolean; go: (p: Page) => void }) {
  const Ic = ICONES[p] ?? CalendarDays
  return (
    <a href={`#${destino(p)}`} onClick={e => { e.preventDefault(); go(destino(p)) }} aria-current={ativo ? 'page' : undefined}
      title={T.nav[p as keyof typeof T.nav]} data-ativo={ativo || undefined}
      className={`ce-topo-item relative inline-flex min-h-[40px] origin-bottom items-center rounded-xl px-2.5 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary ${ativo ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
      <Ic size={18} strokeWidth={ativo ? 2.2 : 1.8} className="ce-ic shrink-0" /><span className="ce-rot">{T.nav[p as keyof typeof T.nav]}</span>
      {n != null && n > 0 && <span className={`mono min-w-[18px] rounded-full px-1.5 text-center text-[11px] leading-[18px] ${aviso ? 'bg-warn text-card' : 'bg-secondary text-foreground'}`} title={aviso ? 'Aguardando a sua validação' : undefined}>{n}</span>}
    </a>
  )
}


function MenuUsuario({ me, dark, setDark, wp, logout, estado, salvo }: { me: { nome: string; perfil: 'equipe' | 'unidade' | 'consulta'; validador?: boolean }; dark: boolean; setDark: (f: (v: boolean) => boolean) => void; wp: boolean; logout?: string; estado: string; salvo: string }) {
  const [aberto, setAberto] = useState(false)
  const ref = useFora(aberto, () => setAberto(false))
  const ini = (me.nome || '?').trim().split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase()
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setAberto(v => !v)} aria-haspopup="menu" aria-expanded={aberto} aria-label={`Conta de ${me.nome}`}
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-primary">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{ini}</span>
        <span className="hidden text-left text-xs leading-tight md:block"><span className="block font-semibold">{me.nome}</span><span className="block text-muted-foreground">{T.perfil[me.perfil]}{me.perfil === 'unidade' && me.validador ? ' · valida' : ''}</span></span>
      </button>
      {aberto && (
        <div role="menu" className="ce-pop absolute right-0 top-full z-50 mt-2 w-60 rounded-xl border bg-card p-1.5 text-sm shadow-xl">
          <div className="px-3 py-2"><div className="font-semibold">{me.nome}</div><div className="text-xs text-muted-foreground">{T.perfil[me.perfil]}{me.perfil === 'unidade' && me.validador ? ' · valida' : ''}</div>
            <div className={`mt-1 text-xs sm:hidden ${salvo === 'erro' ? 'font-semibold text-destructive' : 'text-muted-foreground'}`}>{estado}</div></div>
          {!wp && <button role="menuitem" type="button" onClick={() => setDark(v => !v)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left hover:bg-secondary">{dark ? <Sun size={16} /> : <Moon size={16} />}{dark ? 'Usar tema claro' : 'Usar tema escuro'}</button>}
          {logout && <a role="menuitem" href={logout} className="flex items-center gap-2 rounded-lg px-3 py-2.5 hover:bg-secondary"><LogOut size={16} />{T.geral.sair}</a>}
        </div>
      )}
    </div>
  )
}

/** Menu inferior (celular e tablet): até 5 itens; o que não couber vai para "Mais". */
function BarraInferior({ entradas, atual, count, validar, go, page }: { entradas: string[]; atual: string; count: Partial<Record<string, number>>; validar: number; go: (p: Page) => void; page: string }) {
  const [mais, setMais] = useState(false)
  const ref = useFora(mais, () => setMais(false))
  if (CONFIG_PAGES.includes(page as Page)) ultimaConfig = page as Page
  const cabem = entradas.length <= 5
  const fixos = cabem ? entradas : entradas.slice(0, 4), resto = cabem ? [] : entradas.slice(4)
  const noResto = resto.includes(atual)
  const Item = ({ p, ativo, onClick, rotulo, n, aviso }: { p: string; ativo: boolean; onClick: () => void; rotulo: string; n?: number; aviso?: boolean }) => {
    const Ic = p === 'mais' ? Ellipsis : ICONES[p] ?? CalendarDays
    return (
      <button type="button" onClick={onClick} aria-current={ativo ? 'page' : undefined} aria-expanded={p === 'mais' ? mais : undefined} data-ativo={ativo || undefined}
        aria-label={rotulo} title={rotulo}
        className={`ce-menu-item relative flex min-h-[52px] min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary ${ativo ? 'ce-m-ativo bg-primary/10 text-primary' : 'ce-m-quieto text-muted-foreground'}`}>
        <span className="ce-menu-icone relative"><Ic size={22} strokeWidth={ativo ? 2.2 : 1.7} />
          {n != null && n > 0 && <span className={`mono absolute -right-3 -top-1.5 min-w-[17px] rounded-full px-1 text-center text-[11px] leading-[17px] ${aviso ? 'bg-warn text-card' : 'bg-primary text-primary-foreground'}`}>{n}</span>}
        </span>
        <span className="ce-rot-m truncate">{rotulo}</span>
      </button>
    )
  }
  return (
    <div ref={ref} className="fixed inset-x-0 bottom-0 z-40 px-3 pb-3 lg:hidden">
      {mais && (
        <div role="menu" className="ce-pop mb-2 ml-auto w-56 rounded-xl border bg-card p-1.5 shadow-xl">
          {resto.map(p => { const Ic = ICONES[p] ?? CalendarDays; return (
            <button key={p} role="menuitem" type="button" onClick={() => { setMais(false); go(destino(p)) }} className={`flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium hover:bg-secondary ${atual === p ? 'text-primary' : ''}`}><Ic size={18} />{T.nav[p as keyof typeof T.nav]}</button>
          ) })}
        </div>
      )}
      <nav aria-label="Seções (celular)" className="flex gap-1 rounded-2xl bg-card p-1.5 shadow-lg shadow-black/20 ring-1 ring-black/5">
        {fixos.map(p => <Item key={p} p={p} ativo={atual === p} onClick={() => { setMais(false); go(destino(p)) }} rotulo={T.nav[p as keyof typeof T.nav]} n={p === 'turmas' && validar > 0 ? validar : count[p]} aviso={p === 'turmas' && validar > 0} />)}
        {resto.length > 0 && <Item p="mais" ativo={noResto} onClick={() => setMais(v => !v)} rotulo="Mais" />}
      </nav>
    </div>
  )
}
