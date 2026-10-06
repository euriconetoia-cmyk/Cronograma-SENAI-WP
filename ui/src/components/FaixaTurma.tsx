import { useEffect, useRef, useState } from 'react'
import { Ellipsis, FileSpreadsheet, FileText, Pencil } from 'lucide-react'
import { useExportar } from '@/components/Exportar'
import { StatusBadge } from '@/components/Status'
import type { ExportEntrada } from '@/lib/export'
import { T } from '@/lib/texts'
import type { Curso, Status, Turma, Unidade } from '@/lib/types'

/** Cor de cada status, usada na faixa, na dashboard e nas listas. */
export const COR_STATUS: Record<Status, { borda: string; barra: string }> = {
  solicitado: { borda: 'border-l-primary/50', barra: 'bg-primary/45' },
  elaboracao: { borda: 'border-l-muted-foreground', barra: 'bg-muted-foreground/55' },
  validacao: { borda: 'border-l-warn', barra: 'bg-warn' },
  validado: { borda: 'border-l-ok', barra: 'bg-ok' },
  arquivado: { borda: 'border-l-border', barra: 'bg-border' },
}

interface Props {
  t: Turma; curso: Curso; unidadeNome: string; turmas: Turma[]; unidades: Unidade[]
  inicio: string; fim: string; ch: string; ucs: number
  onTrocar: (id: string) => void; entrada: () => ExportEntrada; onEditarInicio?: () => void; fimErro?: boolean; fimManual?: boolean; onEditarFim?: () => void
}

/** Botão "⋯": trocar de turma e baixar Excel/PDF, sem ocupar espaço na faixa. */
function MaisAcoes({ t, turmas, unidades, onTrocar, entrada }: Pick<Props, 't' | 'turmas' | 'unidades' | 'onTrocar' | 'entrada'>) {
  const [aberto, setAberto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { busy, go } = useExportar(entrada)
  useEffect(() => {
    if (!aberto) return
    const clique = (e: Event) => { const n = e.composedPath()[0] as Node; if (ref.current && !ref.current.contains(n)) setAberto(false) }
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false) }
    document.addEventListener('pointerdown', clique); document.addEventListener('keydown', tecla)
    return () => { document.removeEventListener('pointerdown', clique); document.removeEventListener('keydown', tecla) }
  }, [aberto])
  return (
    <div ref={ref} className="relative shrink-0">
      <button type="button" onClick={() => setAberto(v => !v)} aria-haspopup="menu" aria-expanded={aberto} aria-label="Mais ações: trocar de turma, baixar Excel ou PDF"
        className="grid h-10 w-10 place-items-center rounded-lg border border-white/30 outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white"><Ellipsis size={20} /></button>
      {aberto && (
        <div role="menu" className="ce-pop absolute right-0 top-full z-50 mt-2 w-72 max-w-[85vw] rounded-xl border bg-card p-2 text-sm text-foreground shadow-xl">
          <label className="block px-2 pb-1 pt-1 text-xs font-medium text-muted-foreground" htmlFor="ce-trocar-turma">Trocar turma</label>
          <select id="ce-trocar-turma" className="field-input mb-1" value={t.id} onChange={e => { onTrocar(e.target.value); setAberto(false) }}>
            {turmas.map(x => <option key={x.id} value={x.id}>{x.nome} · {unidades.find(u => u.id === x.unidadeId)?.nome}</option>)}
          </select>
          <div className="my-1 border-t" />
          <button role="menuitem" type="button" disabled={!!busy} onClick={() => void go('xlsx').then(() => setAberto(false))} className="flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 text-left font-medium hover:bg-secondary disabled:opacity-60"><FileSpreadsheet size={18} />{busy === 'xlsx' ? T.exportar.gerando : 'Baixar Excel'}</button>
          <button role="menuitem" type="button" disabled={!!busy} onClick={() => void go('pdf').then(() => setAberto(false))} className="flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 text-left font-medium hover:bg-secondary disabled:opacity-60"><FileText size={18} />{busy === 'pdf' ? T.exportar.gerando : 'Baixar PDF'}</button>
        </div>
      )}
    </div>
  )
}

const EditarMini = ({ onClick, rotulo }: { onClick: () => void; rotulo: string }) => (
  <button type="button" onClick={onClick} aria-label={rotulo} title={rotulo} className="ml-1 inline-grid h-7 w-7 place-items-center rounded-md border border-white/30 align-middle hover:bg-white/10"><Pencil size={13} /></button>
)

/** Faixa fixa no topo: diz, sem precisar procurar, qual é o cronograma aberto. Ao rolar, encolhe para uma linha. */
export function FaixaTurma({ t, curso, unidadeNome, turmas, unidades, inicio, fim, ch, ucs, onTrocar, entrada, onEditarInicio, fimErro, fimManual, onEditarFim }: Props) {
  const [compacto, setCompacto] = useState(false)
  useEffect(() => {
    const f = () => setCompacto(c => (c ? window.scrollY > 40 : window.scrollY > 170))
    f(); window.addEventListener('scroll', f, { passive: true }); return () => window.removeEventListener('scroll', f)
  }, [])
  const mais = <MaisAcoes t={t} turmas={turmas} unidades={unidades} onTrocar={onTrocar} entrada={entrada} />
  return (
    <div className={`sticky top-2 z-30 rounded-xl border-l-8 bg-brand text-brand-foreground shadow-lg shadow-black/20 ${COR_STATUS[t.status].borda}`} aria-label="Cronograma aberto" role="region">
      {compacto ? (
        <div className="flex items-center gap-3 px-4 py-2">
          <span className="min-w-0 truncate font-heading text-sm font-semibold">{curso.nome} · {t.nome}</span>
          <StatusBadge status={t.status} versao={t.versao} />
          <span className="ml-auto">{mais}</span>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-3 px-4 py-3 sm:px-5 sm:py-4">
          <div className="min-w-0">
            <div className="truncate text-xs font-medium uppercase tracking-[.08em] opacity-80">{unidadeNome} › Turma {t.nome || 'sem nome'}</div>
            <h1 className="font-heading text-xl font-semibold leading-tight sm:text-2xl">{curso.nome}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
              <StatusBadge status={t.status} versao={t.versao} />
              <span className="inline-flex items-center">
                <span className="mono font-semibold">{inicio || 'sem início'}</span>
                {onEditarInicio && <EditarMini onClick={onEditarInicio} rotulo="Alterar início" />}
                <span aria-hidden="true" className="mx-1.5 opacity-60">→</span>
                <b className={`mono font-semibold ${fimErro ? 'rounded bg-destructive px-1 text-destructive-foreground' : ''}`} title={fimErro ? 'Termina depois do último feriado cadastrado. Veja em Verificações.' : undefined}>{fim || 'sem término'}</b>
                {fimManual && <span className="ml-1 text-xs opacity-80">(informado)</span>}
                {onEditarFim && <EditarMini onClick={onEditarFim} rotulo={fim ? 'Alterar término' : 'Informar término'} />}
              </span>
              <span className="opacity-85">{ch} · {ucs} UCs</span>
              {curso.categoria && T.categoria[curso.categoria] && <span className="hidden rounded-full border border-white/40 px-2 py-0.5 text-xs font-semibold sm:inline">{T.categoria[curso.categoria].nome}</span>}
              {curso.modalidade && <span className="hidden rounded-full border border-white/40 px-2 py-0.5 text-xs font-semibold sm:inline">{T.modalidade[curso.modalidade]}</span>}
            </div>
          </div>
          {mais}
        </div>
      )}
    </div>
  )
}
