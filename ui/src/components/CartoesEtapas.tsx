import { CalendarCheck, CheckCircle2, CircleDashed, Clock3, TriangleAlert, type LucideIcon } from 'lucide-react'
import { dow, fmtShort, momentos, situacao, toN, type MomentoInstrucional, type Result, type Row, type Situacao } from '@/lib/schedule'
import { T } from '@/lib/texts'
import type { Curso, Encontro, Turma } from '@/lib/types'

const DIA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const SIT: Record<Situacao, { cls: string; Ic: LucideIcon }> = {
  concluida: { cls: 'bg-ok-soft text-ok', Ic: CheckCircle2 },
  andamento: { cls: 'bg-primary/10 text-primary', Ic: Clock3 },
  aIniciar: { cls: 'bg-secondary text-muted-foreground', Ic: CircleDashed },
  semData: { cls: 'bg-warn-soft text-warn', Ic: TriangleAlert },
}
const dia = (d: string | null) => (d ? `${fmtShort(d)} · ${DIA[dow(toN(d))]}` : '—')

interface Props {
  G: Result; t: Turma; curso: Curso; modulo: string; hoje: string; ruins: Set<string>; travado: boolean
  setMomento: (r: Row, lista: MomentoInstrucional[], i: number, patch: Partial<Encontro>) => void
}

/** Visão em cartões para telas pequenas: cada etapa do curso é um cartão (no computador continua a tabela). */
export function CartoesEtapas({ G, t, curso, modulo, hoje, ruins, travado, setMomento }: Props) {
  const mods = curso.modulos.filter(m => (modulo === 'todos' || m.id === modulo) && m.itens.length)
  if (!mods.length) return <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">Nenhuma etapa para mostrar.</p>
  return (
    <div className="flex flex-col gap-4">
      {mods.map(m => (
        <section key={m.id} aria-label={m.nome} className="flex flex-col gap-2.5">
          <h3 className="kicker px-1">{m.nome}</h3>
          {m.itens.map(it => {
            const r = G.by[it.id]; if (!r) return null
            const sit = situacao(r, hoje), S = SIT[sit], enc = momentos(t, r, curso)
            const ativo = sit === 'andamento'
            return (
              <article key={it.id} className={`rounded-xl border bg-card p-3.5 ${ativo ? 'border-primary ring-1 ring-primary/40' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <h4 className="min-w-0 text-[15px] font-semibold leading-snug">{it.nome}</h4>
                  <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${S.cls}`}><S.Ic size={13} />{T.cron.sit[sit]}</span>
                </div>
                <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                  <div><dt className="text-xs text-muted-foreground">Início</dt><dd className="mono font-medium">{dia(r.c.J)}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Término</dt><dd className="mono font-medium">{dia(r.c.K)}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Carga horária</dt><dd className="font-medium">{it.ch || 0} h{it.pres ? ` · ${it.pres} presenciais` : ''}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Término no AVA</dt><dd className="mono font-medium">{dia(r.c.L)}</dd></div>
                </dl>
                {enc.length > 0 && (
                  <div className="mt-3 border-t pt-2.5">
                    <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><CalendarCheck size={14} />{it.tipo === 'intro' ? 'Abertura' : `Momentos pedagógicos (${enc.length})`}</div>
                    <ul className="flex flex-col gap-2">
                      {enc.map((e, i) => {
                        const tipoIx = enc.slice(0, i + 1).filter(x => x.tipo === e.tipo).length
                        const ruim = e.tipo === 'presencial' && it.tipo === 'uc' && ruins.has(`${it.id}:${tipoIx - 1}`)
                        return (
                          <li key={i} className="flex items-center gap-2">
                            <span className="w-16 shrink-0 text-xs text-muted-foreground">{tipoIx}º {e.tipo === 'sincrono' ? 'Sínc.' : 'Pres.'}</span>
                            {it.tipo === 'intro'
                              ? <span className="mono text-sm">{dia(e.d)} · {e.h}</span>
                              : <input type="date" disabled={travado} value={e.d} aria-label={`Data do ${i + 1}º encontro de ${it.nome}`} aria-invalid={ruim || undefined} onChange={ev => setMomento(r, enc, i, { d: ev.target.value })}
                                  className={`field-input mono min-h-[44px] flex-1 ${ruim ? '!border-destructive !bg-bad-soft font-bold !text-destructive ring-2 ring-destructive' : ''}`} />}
                            {ruim && <TriangleAlert size={18} className="shrink-0 text-destructive" aria-label="Data com problema" />}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}
              </article>
            )
          })}
        </section>
      ))}
      <p className="px-1 text-xs text-muted-foreground">Para ver todas as colunas (equipe, webconferência, postagem de notas), abra no computador.</p>
    </div>
  )
}
