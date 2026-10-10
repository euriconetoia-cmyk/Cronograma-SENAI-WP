import { useState } from 'react'
import { toast } from 'sonner'
import { Download, FileCheck2, RotateCcw, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Confirm, Panel } from '@/components/Fields'
import { baixar } from '@/lib/export'
import { useStore } from '@/lib/store'
import { T } from '@/lib/texts'
import type { Copia } from '@/lib/api'

export function BackupPage() {
  const { api, importar } = useStore()
  const [copia, setCopia] = useState<Copia | null>(null)
  const [arquivo, setArquivo] = useState('')
  const [erro, setErro] = useState('')
  const [conf, setConf] = useState(false)
  const [busy, setBusy] = useState(false)
  const [sim, setSim] = useState<{ criadas: number; atualizadas: number; ignoradas: number; confirmacao: string; schemaVersion?: number } | null>(null)

  const baixarCopia = async () => {
    setBusy(true)
    try {
      const c = await api.exportar()
      const nome = `cronogramas-ead-${new Date().toISOString().slice(0, 10)}.json`
      toast(baixar(new Blob([JSON.stringify(c, null, 2)], { type: 'application/json' }), nome) ? T.backup.baixou : 'O navegador bloqueou o download. Permita downloads para este site.')
    } catch (e) { toast(e instanceof Error ? e.message : 'Não foi possível gerar a cópia.') } finally { setBusy(false) }
  }
  const ler = (f?: File) => {
    if (!f) return
    const r = new FileReader()
    r.onload = () => {
      try {
        const o = JSON.parse(String(r.result)) as Copia
        if (!o.catalogo || !o.catalogo.cursos || !o.catalogo.unidades || !Array.isArray(o.turmas)) throw new Error('x')
        setBusy(true)
        api.simularImportacao(o).then(v => { setCopia(o); setArquivo(f.name); setErro(''); setSim({ criadas: v.criadas, atualizadas: v.atualizadas, ignoradas: v.ignoradas, confirmacao: v.confirmacao, schemaVersion: v.schemaVersion }) }).catch(e => { setCopia(null); setArquivo(''); setSim(null); setErro(e instanceof Error ? e.message : T.backup.invalido) }).finally(() => setBusy(false))
      } catch { setCopia(null); setArquivo(''); setSim(null); setErro(T.backup.invalido) }
    }
    r.readAsText(f)
  }
  const carregar = async () => {
    if (!copia || !sim) return
    setBusy(true)
    try { const r = await importar(copia, sim.confirmacao); toast(T.backup.carregado(r.turmas, r.puladas)); setCopia(null); setArquivo(''); setSim(null) } catch (e) { setErro(e instanceof Error ? e.message : T.backup.invalido) } finally { setBusy(false) }
  }
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <Panel title={T.backup.titulo}>
        <p className="mb-2 max-w-prose text-sm text-muted-foreground">{T.backup.ajuda}</p>
        <div className="mb-4 flex max-w-prose gap-2 rounded-md bg-secondary px-3 py-2 text-xs text-muted-foreground"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-primary" /><span>Ao restaurar um backup novo, o sistema volta ao estado salvo no arquivo. Antes disso, uma cópia automática do estado atual é guardada para segurança.</span></div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => void baixarCopia()} disabled={busy}><Download size={15} />{T.backup.baixar}</Button>
          <label className="inline-flex h-10 cursor-pointer items-center rounded-md border px-4 text-sm font-medium hover:bg-accent">{T.backup.escolher}<input type="file" hidden accept=".json,application/json" onChange={e => ler(e.target.files?.[0])} /></label>
          {arquivo && <span className="mono text-xs text-muted-foreground">{arquivo}</span>}
          <Button variant="outline" disabled={!copia || busy} onClick={() => setConf(true)}>{T.backup.carregar}</Button>
        </div>
        {copia && <div className="mt-3 grid gap-2 rounded-md border bg-card p-3 text-sm sm:grid-cols-2">
          <div className="flex items-start gap-2"><FileCheck2 size={16} className="mt-0.5 text-primary" /><span><b>Backup reconhecido</b><br/><span className="text-xs text-muted-foreground">Versão {copia.applicationVersion || 'legada'} · schema {copia.schemaVersion ?? 'legado'}</span></span></div>
          <div className="text-xs text-muted-foreground">{copia.catalogo.cursos.length} curso(s) · {copia.catalogo.unidades.length} unidade(s) · {copia.turmas.length} turma(s){copia.generatedAt ? ` · gerado em ${new Date(copia.generatedAt).toLocaleString('pt-BR')}` : ''}</div>
        </div>}
        {sim && <p role="status" className="mt-3 rounded-md bg-secondary px-3 py-2 text-sm"><RotateCcw size={15} className="mr-1 inline text-primary" />Simulação concluída: o backup contém {sim.criadas + sim.atualizadas + sim.ignoradas} turma(s); {sim.criadas} ainda não existem neste ambiente e {sim.atualizadas} possuem o mesmo identificador. {copia?.backupMode === 'full-state' ? 'A restauração substituirá o estado atual pelo conteúdo desta cópia.' : `${sim.ignoradas} serão ignoradas pelo formato legado.`} Nenhum dado foi alterado ainda.</p>}
        {erro && <p role="alert" className="mt-3 rounded-md bg-bad-soft px-3 py-2 text-sm text-destructive">{erro}</p>}
      </Panel>
      <Confirm copy={conf ? (copia?.backupMode === 'full-state' ? { titulo: 'Restaurar este backup?', texto: 'Cursos, unidades, feriados e turmas serão substituídos pelo estado salvo neste arquivo. Uma cópia automática do estado atual será criada antes.', ok: 'Restaurar backup', voltar: 'Cancelar' } : T.backup.confirma) : null} onClose={() => setConf(false)} onConfirm={() => void carregar()} />
    </div>
  )
}
