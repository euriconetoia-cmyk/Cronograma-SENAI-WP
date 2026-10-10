import { useEffect, useState } from 'react'
import { Eye, EyeOff, KeyRound } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Field, Panel } from '@/components/Fields'
import { useStore } from '@/lib/store'
import { ApiError } from '@/lib/api'

export function IntegracoesPage() {
  const { api } = useStore()
  const [apiKey, setApiKey] = useState('')
  const [configurada, setConfigurada] = useState<boolean | null>(null)
  const [mostrar, setMostrar] = useState(false)
  const [semPermissao, setSemPermissao] = useState(false)
  const [erroConsulta, setErroConsulta] = useState(false)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    void api.feriadosConfig()
      .then(r => { setConfigurada(r.municipalConfigurado); setSemPermissao(false); setErroConsulta(false) })
      .catch(e => {
        if (e instanceof ApiError && e.status === 403) setSemPermissao(true)
        else setErroConsulta(true)
      })
  }, [api])

  const salvar = async () => {
    setSalvando(true)
    try {
      const r = await api.salvarFeriadosConfig(apiKey.trim())
      setConfigurada(r.municipalConfigurado)
      setApiKey('')
      toast(r.municipalConfigurado ? 'Integração de feriados municipais configurada.' : 'Chave da integração removida.')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Não foi possível salvar a configuração.')
    } finally { setSalvando(false) }
  }

  const remover = async () => {
    setSalvando(true)
    try {
      const r = await api.salvarFeriadosConfig('')
      setConfigurada(r.municipalConfigurado)
      setApiKey('')
      toast('Chave da integração removida.')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Não foi possível remover a chave.')
    } finally { setSalvando(false) }
  }

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Integrações">
        <p className="mb-4 max-w-3xl text-sm text-muted-foreground">Configurações técnicas de serviços externos usados pelo sistema. Essas credenciais não aparecem na tela operacional de Feriados.</p>
        {semPermissao ? (
          <div role="status" className="rounded-xl border bg-secondary/40 p-4 text-sm">
            A configuração de credenciais é exclusiva dos administradores do sistema. Solicite apoio à administração para consultar ou alterar a integração de feriados municipais.
          </div>
        ) : erroConsulta ? (
          <div role="alert" className="rounded-xl border bg-secondary/40 p-4 text-sm">
            Não foi possível consultar o estado da integração. Recarregue a página e tente novamente.
          </div>
        ) : configurada === null ? (
          <div role="status" className="rounded-xl border bg-secondary/40 p-4 text-sm">Consultando configuração da integração…</div>
        ) : (
        <div className="rounded-xl border bg-card p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <KeyRound size={17} className="text-primary"/>
            <h2 className="font-heading font-semibold">Feriados municipais</h2>
            <span className={`rounded-full px-2 py-1 text-xs font-semibold ${configurada ? 'bg-ok-soft text-ok' : 'bg-warn-soft text-warn'}`}>{configurada ? 'Configurada' : 'Não configurada'}</span>
          </div>
          <p className="mb-4 max-w-3xl text-sm text-muted-foreground">A integração consulta o calendário municipal usando o código IBGE identificado automaticamente pela cidade e UF da unidade. A chave é armazenada no WordPress e não é exibida novamente depois de salva.</p>
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Chave da API">
              <div className="relative">
                <input type={mostrar ? 'text' : 'password'} autoComplete="off" className="field-input min-w-[300px] pr-10" placeholder={configurada ? 'Informe uma nova chave para substituir' : 'Cole a chave da Feriados API'} value={apiKey} onChange={e => setApiKey(e.target.value)} />
                <button type="button" aria-label={mostrar ? 'Ocultar chave' : 'Mostrar chave'} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setMostrar(v => !v)}>{mostrar ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
              </div>
            </Field>
            <Button type="button" variant="outline" disabled={salvando || !apiKey.trim()} onClick={() => void salvar()}>{salvando ? 'Salvando...' : configurada ? 'Substituir chave' : 'Salvar chave'}</Button>
            {configurada && <Button type="button" variant="ghost" disabled={salvando} onClick={() => void remover()}>Remover chave</Button>}
          </div>
        </div>
        )}
      </Panel>
    </div>
  )
}
