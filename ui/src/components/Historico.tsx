import { useEffect, useState } from 'react'
import { ChevronDown, History } from 'lucide-react'
import { ExportButtons } from '@/components/Exportar'
import { ROTULO_STATUS } from '@/lib/export'
import { dataBr, quando } from '@/lib/format'
import { useStore } from '@/lib/store'
import { T } from '@/lib/texts'
import type { Curso, Historico, Turma } from '@/lib/types'

function valor(campo: string, v: string, pessoas: { id: string; nome: string }[]) {
  if (!v) return '(vazio)'
  if (/(profId|coordId)$/.test(campo)) return pessoas.find(p => p.id === v)?.nome || v
  if (/\.d$/.test(campo) && /^\d{4}-\d{2}-\d{2}$/.test(v)) return dataBr(v)
  return v
}
function rotulo(campo: string, curso?: Curso) {
  const topo: Record<string, string> = { ambiente: 'Ambiente da turma', profId: 'Professor da turma', coordId: 'Coordenador da turma', nome: 'Nome', inicio: 'Início', evento: 'Evento', obs: 'Observações', unidadeId: 'Unidade' }
  if (topo[campo]) return topo[campo]
  const m = campo.match(/^itens\.([^.]+)\.(.+)$/)
  if (!m) return campo
  const nome = curso?.modulos.flatMap(x => x.itens).find(i => i.id === m[1])?.nome || m[1]
  const e = m[2].match(/^enc\.(\d+)\.(d|h|w)$/)
  if (e) return `${nome} · ${+e[1] + 1}º encontro, ${{ d: 'data', h: 'horário', w: 'hora da webconferência' }[e[2] as 'd' | 'h' | 'w']}`
  const camp: Record<string, string> = { ambiente: 'ambiente', profId: 'professor', coordId: 'coordenador', evento: 'evento', monitorId: 'monitor', tutorId: 'tutor', rec: 'dia da recuperação' }
  return `${nome} · ${camp[m[2]] || m[2]}`
}

export function HistoricoPanel({ t, curso, semCabecalho }: { t: Turma; curso?: Curso; semCabecalho?: boolean }) {
  const { api, d } = useStore()
  const [aberto, setAberto] = useState(!!semCabecalho)
  const [h, setH] = useState<Historico | null>(null)
  const [erro, setErro] = useState('')
  useEffect(() => {
    if (!aberto) return
    let vivo = true
    api.historico(t.id).then(r => { if (vivo) { setH(r); setErro('') } }).catch(e => { if (vivo) setErro(e.message) })
    return () => { vivo = false }
  }, [aberto, api, t.id, t.rev, t.status, t.versao])

  const baixarVersao = (n: number) => async () => {
    const v = await api.versao(t.id, n)
    const s = v.snapshot
    return {
      turma: { ...s.turma, itens: s.turma.itens || {} }, curso: s.curso, feriados: s.feriados, pessoas: d.pessoas, unidade: s.unidade,
      status: 'validado' as const, versao: v.versao, suporte: false,
      validacao: `Validado por ${v.por} em ${quando(v.em).slice(0, 10)} (versão ${v.versao})${v.ressalva ? ` · Ressalva: ${v.ressalva}` : ''}`,
    }
  }

  return (
    <div className="rounded-lg border bg-card">
      {!semCabecalho && (      <button type="button" onClick={() => setAberto(v => !v)} aria-expanded={aberto} className="flex w-full items-center gap-2 px-4 py-2.5 text-left">
        <History size={16} className="text-muted-foreground" /><span className="font-heading text-sm font-semibold">{T.hist.titulo}</span>
        <ChevronDown size={16} className={`ml-auto text-muted-foreground transition-transform ${aberto ? 'rotate-180' : ''}`} />
      </button>)}
      {aberto && (
        <div className="grid gap-5 border-t px-4 py-3 lg:grid-cols-[minmax(260px,340px)_minmax(0,1fr)]">
          {erro && <p role="alert" className="text-sm text-destructive lg:col-span-2">{erro}</p>}
          <div>
            <h3 className="kicker mb-2">{T.hist.versoes}</h3>
            {!h ? <p className="text-sm text-muted-foreground">Carregando…</p> : h.versoes.length === 0 ? <p className="text-sm text-muted-foreground">{T.hist.semVersoes}</p> : (
              <ul className="flex flex-col gap-2">
                {h.versoes.map(v => (
                  <li key={v.versao} className="rounded-md border p-2.5">
                    <div className="flex items-center justify-between gap-2"><b className="font-heading text-sm">Versão {v.versao}</b><span className="mono text-xs text-muted-foreground">{quando(v.em)}</span></div>
                    <div className="text-xs text-muted-foreground">Validada por {v.por}</div>
                    {v.ressalva && <div className="mt-0.5 text-xs text-warn">Ressalva: {v.ressalva}</div>}
                    <VersaoExport carregar={baixarVersao(v.versao)} />
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="kicker mb-2">{T.hist.registros}</h3>
            {!h ? null : h.log.length === 0 ? <p className="text-sm text-muted-foreground">{T.hist.vazio}</p> : (
              <ol className="flex max-h-[420px] flex-col gap-2 overflow-auto pr-1">
                {h.log.map(l => (
                  <li key={l.id} className="rounded-md border px-3 py-2 text-sm">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <b className="font-heading">{T.hist.acoes[l.acao] || l.acao}</b>
                      <span className="text-xs text-muted-foreground">{l.quem}{l.perfil ? ` · ${T.perfil[l.perfil] || l.perfil}` : ''} · versão {l.versao}</span>
                      <span className="mono ml-auto text-xs text-muted-foreground">{quando(l.em)}</span>
                    </div>
                    {l.motivo && <p className="mt-0.5">{l.motivo}</p>}
                    {l.detalhe && l.detalhe.length > 0 && (
                      <ul className="mt-1 flex flex-col gap-0.5 text-xs">
                        {l.detalhe.map((c, i) => <li key={i}><span className="text-muted-foreground">{rotulo(c.campo, curso)}:</span> {valor(c.campo, c.de, d.pessoas)} <span aria-hidden>→</span><span className="sr-only">para</span> <b>{valor(c.campo, c.para, d.pessoas)}</b></li>)}
                      </ul>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}
      <span className="sr-only">{ROTULO_STATUS[t.status]}</span>
    </div>
  )
}

function VersaoExport({ carregar }: { carregar: () => Promise<Parameters<typeof import('@/lib/export').montarModelo>[0]> }) {
  const [e, setE] = useState<Parameters<typeof import('@/lib/export').montarModelo>[0] | null>(null)
  useEffect(() => { let vivo = true; carregar().then(x => { if (vivo) setE(x) }).catch(() => undefined); return () => { vivo = false } }, []) // eslint-disable-line react-hooks/exhaustive-deps
  if (!e) return <div className="mt-2 text-xs text-muted-foreground">Preparando arquivos…</div>
  return <div className="mt-2 flex flex-wrap gap-2"><ExportButtons size="sm" entrada={() => e} /></div>
}
