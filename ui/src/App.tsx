import { Component, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Toaster } from '@/components/ui/sonner'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Shell } from '@/components/Shell'
import { config, realApi, type Api } from '@/lib/api'
import { mockApi } from '@/lib/mock'
import { CONFIG_PAGES, StoreProvider, useStore } from '@/lib/store'
import { T } from '@/lib/texts'
import { InicioPage } from '@/pages/Inicio'
import { CronogramaPage } from '@/pages/Cronograma'
import { TurmasPage } from '@/pages/Turmas'
import { CursosPage } from '@/pages/Cursos'
import { EquipePage } from '@/pages/Equipe'
import { UnidadesPage } from '@/pages/Unidades'
import { FeriadosPage } from '@/pages/Feriados'
import { BackupPage } from '@/pages/Backup'
import { AcessosPage } from '@/pages/Acessos'
import { IntegracoesPage } from '@/pages/Integracoes'
import { ConfigLayout } from '@/pages/Config'

/** Se uma tela falhar, mostra um aviso com saída em vez de deixar a página em branco. */
class Protecao extends Component<{ children: ReactNode }, { erro: Error | null }> {
  state = { erro: null as Error | null }
  static getDerivedStateFromError(erro: Error) { return { erro } }
  componentDidCatch(erro: Error) { console.error('[Cronogramas EaD]', erro) }
  render() {
    if (!this.state.erro) return this.props.children
    return (
      <div role="alert" className="rounded-lg border border-destructive/40 bg-bad-soft p-5 text-sm">
        <h2 className="font-heading text-base font-semibold text-destructive">Não foi possível abrir esta tela</h2>
        <p className="mt-1 max-w-prose">Algo nos dados desta página impediu a exibição. Nada foi perdido. Volte ao Início ou tente de novo; se continuar, informe a mensagem abaixo à equipe.</p>
        <p className="mono mt-2 break-words text-xs text-muted-foreground">{this.state.erro.message}</p>
        <div className="mt-3 flex gap-2">
          <Button onClick={() => { window.location.hash = '#inicio'; this.setState({ erro: null }) }}>Voltar ao Início</Button>
          <Button variant="outline" onClick={() => this.setState({ erro: null })}>Tentar de novo</Button>
        </div>
      </div>
    )
  }
}


function EstadoRede() {
  const [online, setOnline] = useState(() => navigator.onLine)
  const [sessao, setSessao] = useState(false)
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false)
    const api = (e: Event) => setOnline(Boolean((e as CustomEvent<{ online: boolean }>).detail?.online))
    const expired = () => setSessao(true)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    window.addEventListener('cronograma:network', api); window.addEventListener('cronograma:session-expired', expired)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); window.removeEventListener('cronograma:network', api); window.removeEventListener('cronograma:session-expired', expired) }
  }, [])
  if (sessao) return <div role="alert" className="mb-3 rounded-md bg-bad-soft px-3 py-2 text-sm text-destructive">Sua sessão expirou. Recarregue a página e entre novamente antes de continuar editando.</div>
  if (!online) return <div role="status" className="mb-3 rounded-md bg-secondary px-3 py-2 text-sm">Sem conexão. Alterações ainda não confirmadas pelo servidor devem ser preservadas até a reconexão.</div>
  return null
}

function Router() {
  const { page, pages } = useStore()
  const p = pages.includes(page) ? page : 'inicio'
  const pagina = (() => {
    switch (p) {
      case 'cronograma': return <CronogramaPage />
      case 'turmas': return <TurmasPage />
      case 'cursos': return <CursosPage />
      case 'equipe': return <EquipePage />
      case 'acessos': return <AcessosPage />
      case 'unidades': return <UnidadesPage />
      case 'feriados': return <FeriadosPage />
      case 'integracoes': return <IntegracoesPage />
      case 'backup': return <BackupPage />
      default: return <InicioPage />
    }
  })()
  return CONFIG_PAGES.includes(p) ? <ConfigLayout>{pagina}</ConfigLayout> : pagina
}

function Conflito() {
  const { conflito, fecharConflito, recarregar } = useStore()
  return (
    <Dialog open={!!conflito} onOpenChange={o => { if (!o) fecharConflito() }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{T.fluxo.conflito.titulo}</DialogTitle><DialogDescription>{conflito}</DialogDescription></DialogHeader>
        <DialogFooter className="gap-2"><Button variant="outline" onClick={() => { fecharConflito(); void recarregar() }}>Recarregar tudo</Button><Button onClick={fecharConflito}>{T.fluxo.conflito.ok}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function App() {
  const c = config()
  const api: Api = useMemo(() => (c ? realApi(c) : mockApi), [c])
  const q = new URLSearchParams(window.location.search).get('turma') || c?.turma || ''
  return (
    <StoreProvider api={api} view={c?.view} turmaInicial={q}>
      <Shell><EstadoRede /><Protecao><Router /></Protecao></Shell>
      <Conflito />
      <Toaster position="bottom-center" />
    </StoreProvider>
  )
}
