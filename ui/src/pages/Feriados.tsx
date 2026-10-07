import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { MapPin, RefreshCw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, Panel } from '@/components/Fields'
import { useStore } from '@/lib/store'
import { T } from '@/lib/texts'
import { fmt } from '@/lib/schedule'

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const pad = (n: number) => (n < 10 ? '0' : '') + n

export function FeriadosPage() {
  const { api, d, update, me } = useStore()
  const equipe = me.perfil === 'equipe'
  const [escopo, setEscopo] = useState('')
  const anos = useMemo(() => Array.from(new Set(d.feriados.map(f => f[0].slice(0, 4)))).sort(), [d.feriados])
  const [ano, setAno] = useState(() => (anos.includes(String(new Date().getFullYear())) ? String(new Date().getFullYear()) : anos[0] || String(new Date().getFullYear())))
  const [data, setData] = useState('')
  const [motivo, setMotivo] = useState('')
  const [sincronizando, setSincronizando] = useState(false)
  const sincronizados = useRef(new Set<string>())
  const unidadeAtual = d.unidades.find(u => u.id === escopo)
  const lista = useMemo(() => d.feriados
    .map((f, i) => ({ f, i }))
    .filter(x => x.f[0].startsWith(ano) && (escopo ? (!x.f[2] || x.f[2] === escopo) : !x.f[2]))
    .sort((a, b) => a.f[0].localeCompare(b.f[0]) || a.f[1].localeCompare(b.f[1])), [d.feriados, ano, escopo])
  const mapa = useMemo(() => {
    const m = new Map<string, typeof lista>()
    for (const item of lista) {
      const atual = m.get(item.f[0]) || []
      atual.push(item)
      m.set(item.f[0], atual)
    }
    return m
  }, [lista])

  const add = (dt: string, m?: string) => {
    if (!dt) { toast(T.feriados.escolhaData); return }
    const jaNoEscopo = d.feriados.some(f => f[0] === dt && (f[2] || '') === escopo)
    if (jaNoEscopo) { toast(T.feriados.jaExiste); return }
    update(x => { x.feriados.push(escopo ? [dt, (m ?? motivo).trim() || T.feriados.padrao, escopo, 'institucional', 'Manual'] : [dt, (m ?? motivo).trim() || T.feriados.padrao, undefined, 'institucional', 'Manual']); x.feriados.sort((a, b) => (a[0] < b[0] ? -1 : 1)) })
    setAno(dt.slice(0, 4)); setData(''); toast(T.feriados.adicionada)
  }
  const remover = (dt: string) => update(x => { x.feriados = x.feriados.filter(f => !(f[0] === dt && (f[2] || '') === escopo)) })
  const sincronizarNacionais = async (forcar = false) => {
    if (!equipe || escopo) return
    if (!forcar && sincronizados.current.has(ano)) return
    setSincronizando(true)
    try {
      const r = await api.feriadosNacionais(+ano)
      let novosCount = 0
      update(x => {
        for (const h of r.feriados) {
          const ex = x.feriados.find(f => f[0] === h[0] && !f[2] && (f[3] === 'nacional' || !f[3]))
          if (ex) { ex[1] = h[1]; ex[3] = 'nacional'; ex[4] = 'BrasilAPI' }
          else { x.feriados.push([h[0], h[1], undefined, 'nacional', 'BrasilAPI']); novosCount++ }
        }
        x.feriados.sort((a, b) => a[0].localeCompare(b[0]))
      })
      sincronizados.current.add(ano)
      if (forcar) toast(novosCount ? `${novosCount} feriado(s) nacional(is) adicionado(s).` : 'Feriados nacionais já estavam atualizados.')
    } catch (e) {
      if (forcar) toast(e instanceof Error ? e.message : 'Não foi possível atualizar os feriados nacionais.')
    } finally { setSincronizando(false) }
  }
  useEffect(() => { void sincronizarNacionais(false) }, [ano, equipe, escopo]) // eslint-disable-line react-hooks/exhaustive-deps

  const sincronizarLocal = async () => {
    if (!equipe || !escopo) return
    setSincronizando(true)
    try {
      const [nac, r] = await Promise.all([api.feriadosNacionais(+ano), api.feriadosLocal(escopo, +ano)])
      update(x => {
        for (const h of nac.feriados) {
          const ex = x.feriados.find(f => f[0] === h[0] && !f[2] && (f[3] === 'nacional' || !f[3]))
          if (ex) { ex[1] = h[1]; ex[3] = 'nacional'; ex[4] = 'BrasilAPI' }
          else x.feriados.push([h[0], h[1], undefined, 'nacional', 'BrasilAPI'])
        }
        x.feriados = x.feriados.filter(f => !(f[2] === escopo && f[0].startsWith(ano) && (f[3] === 'estadual' || f[3] === 'municipal')))
        for (const h of r.feriados) x.feriados.push([h[0], h[1], escopo, h[2], h[3]])
        x.feriados.sort((a, b) => a[0].localeCompare(b[0]))
        const u = x.unidades.find(u => u.id === escopo)
        if (u) { u.cidade = r.localidade.cidade; u.estado = r.localidade.uf; u.codigoIbge = r.localidade.codigoIbge }
      })
      const est = r.feriados.filter(h => h[2] === 'estadual').length
      const mun = r.feriados.filter(h => h[2] === 'municipal').length
      toast(`Calendário completo de ${r.localidade.cidade}/${r.localidade.uf}: ${nac.feriados.length} nacional(is), ${est} estadual(is) e ${mun} municipal(is).`)
      r.avisos.forEach(a => toast(a))
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Não foi possível atualizar o calendário completo da unidade.')
    } finally { setSincronizando(false) }
  }


  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,420px)]">
      <Panel title={T.feriados.titulo} actions={
        <div className="flex flex-wrap items-center gap-3">
        {equipe && <label className="flex items-center gap-2 text-sm"><span className="kicker">{T.feriados.valeEm}</span>
          <select className="field-input w-auto" value={escopo} onChange={e => setEscopo(e.target.value)}><option value="">{T.feriados.todas}</option>{d.unidades.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}</select></label>}
        <label className="flex items-center gap-2 text-sm"><span className="kicker">{T.feriados.ano}</span>
          <select className="field-input w-auto" value={ano} onChange={e => setAno(e.target.value)}>{Array.from(new Set([...anos, String(new Date().getFullYear()), String(new Date().getFullYear()+1)])).sort().map(a => <option key={a}>{a}</option>)}</select></label>
        {equipe && !escopo && <Button size="sm" variant="outline" disabled={sincronizando} onClick={() => void sincronizarNacionais(true)}><RefreshCw size={14} className={sincronizando ? 'animate-spin' : ''} />Atualizar nacionais</Button>}
        {equipe && escopo && <Button size="sm" variant="outline" disabled={sincronizando || !unidadeAtual?.cidade || !unidadeAtual?.estado} onClick={() => void sincronizarLocal()}><MapPin size={14}/><RefreshCw size={14} className={sincronizando ? 'animate-spin' : ''} />Atualizar calendário local</Button>}</div>}>
        <p className="mb-3 max-w-prose text-sm text-muted-foreground">{escopo ? T.feriados.ajudaUnidade : T.feriados.ajuda}</p>
        {escopo && unidadeAtual && <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border bg-secondary/40 px-3 py-2 text-sm">
          <MapPin size={15} className="text-primary"/>
          <b>{unidadeAtual.cidade || 'Cidade não informada'} / {unidadeAtual.estado || 'UF'}</b>
          <span className="text-muted-foreground">{unidadeAtual.codigoIbge ? `IBGE ${unidadeAtual.codigoIbge}` : 'localidade ainda não validada'}</span>
          <span className="ml-auto text-xs text-muted-foreground">Calendário efetivo = nacionais + estaduais + municipais + institucionais</span>
        </div>}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {MESES.map((nome, m) => {
            const first = new Date(Date.UTC(+ano, m, 1)), dias = new Date(Date.UTC(+ano, m + 1, 0)).getUTCDate(), off = first.getUTCDay()
            return (
              <div key={nome} className="rounded-md border bg-card p-2">
                <div className="mb-1 font-heading text-sm font-semibold">{nome}</div>
                <div className="grid grid-cols-7 gap-px text-center text-[10px] uppercase text-muted-foreground">{['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((x, i) => <span key={i}>{x}</span>)}</div>
                <div className="grid grid-cols-7 gap-px">
                  {Array.from({ length: off }).map((_, i) => <span key={`o${i}`} />)}
                  {Array.from({ length: dias }).map((_, i) => {
                    const key = `${ano}-${pad(m + 1)}-${pad(i + 1)}`, wk = (off + i) % 7, fim = wk === 0 || wk === 6
                    const hs = mapa.get(key) || []
                    const temNacional = hs.some(x => !x.f[2] && (x.f[3] === 'nacional' || !x.f[3]))
                    const temRegional = hs.some(x => x.f[2] === escopo && (x.f[3] === 'estadual' || x.f[3] === 'municipal'))
                    const temInstitucional = hs.some(x => x.f[3] === 'institucional')
                    const titulo = hs.length ? hs.map(x => `${x.f[1]} [${x.f[3] || (!x.f[2] ? 'nacional' : 'institucional')}]`).join(' · ') : 'Clique para marcar uma data institucional'
                    return (
                      <button key={key} type="button" title={titulo}
                        disabled={!equipe} onClick={() => hs.length ? toast(titulo) : add(key, motivo)}
                        className={`mono h-6 rounded-sm text-[11px] ${temRegional ? 'bg-primary font-semibold text-primary-foreground' : temNacional ? 'bg-warn font-semibold text-card' : temInstitucional ? 'bg-secondary font-semibold text-foreground' : fim ? 'text-muted-foreground/60 hover:bg-secondary' : 'hover:bg-accent'}`}>{i + 1}</button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span><b className="text-warn">■</b> Nacional</span>
          <span><b className="text-primary">■</b> Estadual / Municipal</span>
          <span><b>■</b> Institucional</span>
          <span>Todos são tratados como dias não úteis no cálculo da unidade.</span>
        </div>
      </Panel>

      <Panel title={`Datas de ${ano} (${lista.length})`}>
        {equipe && <form className="mb-3 flex flex-wrap items-end gap-2" onSubmit={e => { e.preventDefault(); add(data) }}>
          <Field label={T.feriados.data}><input type="date" className="field-input" value={data} onChange={e => setData(e.target.value)} /></Field>
          <Field label={T.feriados.motivo}><input className="field-input" placeholder="Ex.: Feriado" value={motivo} onChange={e => setMotivo(e.target.value)} /></Field>
          <Button type="submit">{T.feriados.adicionar}</Button>
        </form>}
        <div className="max-h-[520px] overflow-auto rounded-md border">
          <table className="w-full text-[13px]">
            <tbody>
              {lista.map(({ f, i }) => {
                const herdado = !!escopo && !f[2]
                const tipo = f[3] || (!f[2] ? 'nacional' : 'institucional')
                return (
                <tr key={`${f[0]}-${i}`} className="border-b last:border-0">
                  <td className="mono whitespace-nowrap px-2 py-1">{fmt(f[0])}</td>
                  <td className="px-1">
                    <div className="flex items-center gap-2">
                      <input disabled={!equipe || herdado} aria-label={`Motivo de ${f[0]}`} className="cell-input" value={f[1]} onChange={e => update(x => { x.feriados[i][1] = e.target.value })} />
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${tipo === 'municipal' ? 'bg-primary/10 text-primary' : tipo === 'estadual' ? 'bg-accent text-foreground' : tipo === 'nacional' ? 'bg-warn-soft text-warn' : 'bg-secondary text-muted-foreground'}`}>{tipo}</span>
                      {herdado && <span className="text-[10px] text-muted-foreground">herdado</span>}
                    </div>
                  </td>
                  <td className="px-1 text-right">{equipe && !herdado && <Button size="icon" variant="ghost" className="text-destructive" aria-label={`Remover ${f[0]}`} onClick={() => remover(f[0])}><Trash2 size={14} /></Button>}</td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      </Panel>


    </div>
  )
}
