import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { KeyRound, MapPin, RefreshCw, Trash2 } from 'lucide-react'
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
  const [configMunicipal, setConfigMunicipal] = useState<boolean | null>(null)
  const [apiKey, setApiKey] = useState('')
  const sincronizados = useRef(new Set<string>())
  const mapa = useMemo(() => new Map(d.feriados.filter(f => (f[2] || '') === escopo).map(f => [f[0], f[1]])), [d.feriados, escopo])
  const gerais = useMemo(() => new Set(d.feriados.filter(f => !f[2]).map(f => f[0])), [d.feriados])
  const lista = d.feriados.map((f, i) => ({ f, i })).filter(x => x.f[0].startsWith(ano) && (x.f[2] || '') === escopo)
  const unidadeAtual = d.unidades.find(u => u.id === escopo)

  const add = (dt: string, m?: string) => {
    if (!dt) { toast(T.feriados.escolhaData); return }
    if (mapa.has(dt)) { toast(T.feriados.jaExiste); return }
    update(x => { x.feriados.push(escopo ? [dt, (m ?? motivo).trim() || T.feriados.padrao, escopo] : [dt, (m ?? motivo).trim() || T.feriados.padrao]); x.feriados.sort((a, b) => (a[0] < b[0] ? -1 : 1)) })
    setAno(dt.slice(0, 4)); setData(''); toast(T.feriados.adicionada)
  }
  const remover = (dt: string) => update(x => { x.feriados = x.feriados.filter(f => !(f[0] === dt && (f[2] || '') === escopo)) })
  const sincronizarNacionais = async (forcar = false) => {
    if (!equipe || escopo) return
    if (!forcar && sincronizados.current.has(ano)) return
    setSincronizando(true)
    try {
      const r = await api.feriadosNacionais(+ano)
      const existentes = new Set(d.feriados.filter(x => !x[2]).map(x => x[0]))
      const novos = r.feriados.filter(x => !existentes.has(x[0]))
      if (novos.length) update(x => {
        for (const h of novos) x.feriados.push([h[0], h[1]])
        x.feriados.sort((a, b) => a[0].localeCompare(b[0]))
      })
      sincronizados.current.add(ano)
      if (forcar) toast(novos.length ? `${novos.length} feriado(s) nacional(is) adicionado(s).` : 'Feriados nacionais já estavam atualizados.')
    } catch (e) {
      if (forcar) toast(e instanceof Error ? e.message : 'Não foi possível atualizar os feriados nacionais.')
    } finally { setSincronizando(false) }
  }
  useEffect(() => { void sincronizarNacionais(false) }, [ano, equipe, escopo]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!equipe) return
    void api.feriadosConfig().then(r => setConfigMunicipal(r.municipalConfigurado)).catch(() => setConfigMunicipal(false))
  }, [api, equipe])

  const sincronizarLocal = async () => {
    if (!equipe || !escopo) return
    setSincronizando(true)
    try {
      const r = await api.feriadosLocal(escopo, +ano)
      update(x => {
        x.feriados = x.feriados.filter(f => !(f[2] === escopo && f[0].startsWith(ano) && (f[3] === 'estadual' || f[3] === 'municipal')))
        for (const h of r.feriados) x.feriados.push([h[0], h[1], escopo, h[2], h[3]])
        x.feriados.sort((a, b) => a[0].localeCompare(b[0]))
        const u = x.unidades.find(u => u.id === escopo)
        if (u) { u.cidade = r.localidade.cidade; u.estado = r.localidade.uf; u.codigoIbge = r.localidade.codigoIbge }
      })
      setConfigMunicipal(r.municipalConfigurado)
      const est = r.feriados.filter(h => h[2] === 'estadual').length
      const mun = r.feriados.filter(h => h[2] === 'municipal').length
      toast(`Calendário de ${r.localidade.cidade}/${r.localidade.uf} atualizado: ${est} estadual(is) e ${mun} municipal(is).`)
      r.avisos.forEach(a => toast(a))
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Não foi possível atualizar o calendário local.')
    } finally { setSincronizando(false) }
  }

  const salvarApiMunicipal = async () => {
    try {
      const r = await api.salvarFeriadosConfig(apiKey.trim())
      setConfigMunicipal(r.municipalConfigurado)
      setApiKey('')
      toast(r.municipalConfigurado ? 'Fonte de feriados municipais configurada.' : 'Chave municipal removida.')
    } catch (e) { toast(e instanceof Error ? e.message : 'Não foi possível salvar a configuração municipal.') }
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
                    const key = `${ano}-${pad(m + 1)}-${pad(i + 1)}`, wk = (off + i) % 7, fim = wk === 0 || wk === 6, h = mapa.get(key), geral = !!escopo && gerais.has(key)
                    return (
                      <button key={key} type="button" title={h ? `${h} (clique para remover)` : 'Clique para marcar como feriado'}
                        disabled={!equipe} onClick={() => (h ? remover(key) : add(key, motivo))}
                        className={`mono h-6 rounded-sm text-[11px] ${h ? 'bg-warn font-semibold text-card' : geral ? 'bg-warn-soft text-warn' : fim ? 'text-muted-foreground/60 hover:bg-secondary' : 'hover:bg-accent'}`}>{i + 1}</button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{T.feriados.legenda} Clique em um dia para marcar ou desmarcar.</p>
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
              {lista.map(({ f, i }) => (
                <tr key={f[0]} className="border-b last:border-0">
                  <td className="mono whitespace-nowrap px-2 py-1">{fmt(f[0])}</td>
                  <td className="px-1">
                    <div className="flex items-center gap-2">
                      <input disabled={!equipe} aria-label={`Motivo de ${f[0]}`} className="cell-input" value={f[1]} onChange={e => update(x => { x.feriados[i][1] = e.target.value })} />
                      {f[3] && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${f[3] === 'municipal' ? 'bg-primary/10 text-primary' : f[3] === 'estadual' ? 'bg-accent text-foreground' : 'bg-secondary text-muted-foreground'}`}>{f[3]}</span>}
                    </div>
                  </td>
                  <td className="px-1 text-right">{equipe && <Button size="icon" variant="ghost" className="text-destructive" aria-label={`Remover ${f[0]}`} onClick={() => remover(f[0])}><Trash2 size={14} /></Button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {equipe && <Panel title="Feriados municipais — integração" >
        <div className="flex items-start gap-2 text-sm">
          <KeyRound size={16} className="mt-0.5 text-primary"/>
          <div className="min-w-0 flex-1">
            <p className="mb-2 text-muted-foreground">Para consultar feriados municipais de todas as cidades, configure a chave da Feriados API. A chave fica armazenada somente no WordPress e não é exibida novamente na interface.</p>
            <div className="flex flex-wrap items-end gap-2">
              <Field label="Chave da API"><input type="password" autoComplete="off" className="field-input min-w-[260px]" placeholder={configMunicipal ? 'Configurada — informe outra para substituir' : 'Cole a chave da API'} value={apiKey} onChange={e => setApiKey(e.target.value)} /></Field>
              <Button type="button" variant="outline" onClick={() => void salvarApiMunicipal()}>{configMunicipal ? 'Atualizar chave' : 'Salvar chave'}</Button>
              <span className={`rounded-full px-2 py-1 text-xs font-semibold ${configMunicipal ? 'bg-ok-soft text-ok' : 'bg-warn-soft text-warn'}`}>{configMunicipal ? 'Municipais habilitados' : 'Municipais não configurados'}</span>
            </div>
          </div>
        </div>
      </Panel>}
    </div>
  )
}
