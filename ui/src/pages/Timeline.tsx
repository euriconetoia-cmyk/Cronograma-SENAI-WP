import { useMemo } from 'react'
import { encontros, fmtShort, situacao, toN, type Result } from '@/lib/schedule'
import type { Curso, Turma } from '@/lib/types'

const BAR: Record<string, string> = { intro: 'bg-ok', uc: 'bg-primary', rec: 'bg-warn', mat: 'bg-ok' }
const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

export function Timeline({ G, t, curso, modulo, hoje }: { G: Result; t: Turma; curso: Curso; modulo: string; hoje: string }) {
  const M = useMemo(() => {
    const ds = G.rows.flatMap(r => [r.c.J, r.c.K]).filter(Boolean) as string[]
    if (!ds.length) return null
    const a = toN(ds.reduce((x, y) => (y < x ? y : x))), b = toN(ds.reduce((x, y) => (y > x ? y : x)))
    const first = new Date(a * 864e5), meses: { n: number; label: string }[] = []
    let y = first.getUTCFullYear(), m = first.getUTCMonth()
    const start = Math.round(Date.UTC(y, m, 1) / 864e5)
    for (;;) {
      const n = Math.round(Date.UTC(y, m, 1) / 864e5)
      if (n > b) break
      meses.push({ n, label: `${MES[m]}/${String(y).slice(2)}` })
      m++; if (m > 11) { m = 0; y++ }
    }
    const end = Math.round(Date.UTC(y, m, 1) / 864e5)
    return { start, end, meses, span: end - start }
  }, [G])
  if (!M) return <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">Informe a data de início da turma para ver a linha do tempo.</div>
  const pct = (n: number) => `${((n - M.start) / M.span) * 100}%`
  const hojeN = toN(hoje)
  return (
    <div className="overflow-auto rounded-lg border bg-card">
      <div className="min-w-[1100px]">
        <div className="sticky top-0 z-20 flex border-b bg-secondary">
          <div className="sticky left-0 z-30 w-[260px] shrink-0 border-r bg-secondary px-3 py-2 font-heading text-xs font-semibold">Unidade curricular</div>
          <div className="relative h-8 flex-1">
            {M.meses.map(m => (
              <div key={m.n} className="absolute top-0 h-full border-l px-1 pt-1.5 font-heading text-[11px] uppercase tracking-wide text-muted-foreground" style={{ left: pct(m.n) }}>{m.label}</div>
            ))}
          </div>
        </div>
        {curso.modulos.filter(m => modulo === 'todos' || m.id === modulo).map(m => (
          <div key={m.id}>
            <div className="sticky left-0 border-b bg-row-mod px-3 py-1 font-heading text-xs font-semibold uppercase tracking-[.08em]">{m.nome}</div>
            {m.itens.map(it => {
              const r = G.by[it.id]
              const enc = encontros(t, r, curso).filter(e => e.d && it.tipo === 'uc')
              const sit = situacao(r, hoje)
              return (
                <div key={it.id} className="flex border-b">
                  <div className={`sticky left-0 z-10 w-[260px] shrink-0 border-r px-3 py-1.5 text-[13px] ${it.tipo === 'rec' ? 'bg-row-rec' : it.tipo === 'uc' ? 'bg-card' : 'bg-row-intro'} ${sit === 'andamento' ? 'font-semibold' : ''}`}>{it.nome}</div>
                  <div className="relative h-9 flex-1">
                    {M.meses.map(mm => <div key={mm.n} className="absolute top-0 h-full border-l border-dashed" style={{ left: pct(mm.n) }} />)}
                    {hojeN >= M.start && hojeN <= M.end && <div className="absolute top-0 z-[5] h-full w-px bg-destructive" style={{ left: pct(hojeN) }} />}
                    {r.c.J && r.c.K && (
                      <div className={`absolute top-2 h-5 rounded-sm ${BAR[it.tipo]} ${sit === 'concluida' ? 'opacity-45' : ''}`}
                        style={{ left: pct(toN(r.c.J)), width: `max(4px, calc(${pct(toN(r.c.K) + 1)} - ${pct(toN(r.c.J))}))` }}
                        title={`${it.nome}: ${fmtShort(r.c.J)} a ${fmtShort(r.c.K)}`} />
                    )}
                    {enc.map((e, i) => (
                      <div key={i} className="absolute top-[11px] z-[6] h-3 w-3 rotate-45 border-2 border-card bg-brand" style={{ left: `calc(${pct(toN(e.d))} - 6px)` }} title={`${i + 1}º encontro: ${fmtShort(e.d)}`} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-4 border-t px-3 py-2 text-xs text-muted-foreground">
        <span><i className="mr-1.5 inline-block h-2.5 w-4 rounded-sm bg-primary align-middle" />Unidade curricular</span>
        <span><i className="mr-1.5 inline-block h-2.5 w-4 rounded-sm bg-warn align-middle" />Recuperação</span>
        <span><i className="mr-1.5 inline-block h-2.5 w-4 rounded-sm bg-ok align-middle" />Introdução e Matrícula</span>
        <span><i className="mr-1.5 inline-block h-2.5 w-2.5 rotate-45 bg-brand align-middle" />Encontro presencial</span>
        <span><i className="mr-1.5 inline-block h-3 w-px bg-destructive align-middle" />Hoje</span>
      </div>
    </div>
  )
}
