import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { KeyRound, Mail, Pencil, Power, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Empty, Panel } from '@/components/Fields'
import { useStore } from '@/lib/store'
import { quando } from '@/lib/format'
import type { Acesso, AcessosLista, TipoAcesso } from '@/lib/types'

const TIPOS: { id: TipoAcesso; nome: string; texto: string }[] = [
  { id: 'equipe', nome: 'Equipe Unidigit@l', texto: 'Cria e conduz os cronogramas, cadastra cursos, turmas e feriados. Só o administrador do site cria este tipo.' },
  { id: 'coordenador', nome: 'Coordenador da unidade', texto: 'Ajusta e valida os cronogramas da sua unidade.' },
  { id: 'auxiliar', nome: 'Auxiliar da unidade', texto: 'Ajusta os cronogramas da sua unidade, mas não valida.' },
  { id: 'consulta', nome: 'Consulta', texto: 'Só vê os cronogramas da sua unidade.' },
]
const NOME_TIPO = Object.fromEntries(TIPOS.map(t => [t.id, t.nome])) as Record<TipoAcesso, string>
const COR_TIPO: Record<TipoAcesso, string> = { equipe: 'bg-brand text-brand-foreground', coordenador: 'bg-ok-soft text-ok', auxiliar: 'bg-secondary text-foreground', consulta: 'bg-secondary text-muted-foreground' }

interface Forma { id: number | null; nome: string; email: string; tipo: TipoAcesso; unidades: string[]; enviarEmail: boolean }
const VAZIA: Forma = { id: null, nome: '', email: '', tipo: 'coordenador', unidades: [], enviarEmail: true }


export function AcessosPage() {
  const { api, d, me } = useStore()
  const [testando, setTestando] = useState(false)
  const [teste, setTeste] = useState<{ ok: boolean; para: string } | null>(null)
  const testarEmail = async () => { setTestando(true); setTeste(null); try { setTeste(await api.emailTeste()) } catch (e) { toast(e instanceof Error ? e.message : 'Não foi possível testar.') } finally { setTestando(false) } }
  const [lista, setLista] = useState<AcessosLista | null>(null)
  const [erro, setErro] = useState('')
  const [form, setForm] = useState<Forma | null>(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const carregar = useCallback(async () => {
    try { setLista(await api.acessos()); setErro('') } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível carregar os acessos.') }
  }, [api])
  useEffect(() => { void carregar() }, [carregar])

  const nomeUnidade = (id: string) => d.unidades.find(u => u.id === id)?.nome || id
  const podeEquipe = lista?.podeEquipe ?? !!me.podeEquipe
  const tiposDisponiveis = TIPOS.filter(t => t.id !== 'equipe' || podeEquipe)

  const salvar = async () => {
    if (!form) return
    setBusy(true); setMsg('')
    try {
      if (form.id === null) {
        const r = await api.criarAcesso({ nome: form.nome, email: form.email, tipo: form.tipo, unidades: form.unidades, enviarEmail: form.enviarEmail })
        toast(r.emailEnviado ? 'Acesso criado e link enviado por e-mail.' : 'Acesso criado. O e-mail não foi enviado; use Enviar acesso depois de configurar o SMTP.')
      } else {
        await api.salvarAcesso(form.id, { nome: form.nome, email: form.email, tipo: form.tipo, unidades: form.unidades })
        toast('Acesso atualizado.')
      }
      setForm(null); await carregar()
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Não foi possível salvar.') } finally { setBusy(false) }
  }

  const novoLink = async (a: Acesso) => {
    try { await api.linkAcesso(a.id); toast(`Link de acesso enviado para ${a.email}.`) } catch (e) { toast(e instanceof Error ? e.message : 'Não foi possível enviar o acesso.') }
  }
  const alternar = async (a: Acesso) => {
    try { await api.salvarAcesso(a.id, { ativo: !a.ativo }); toast(a.ativo ? `${a.nome} não consegue mais entrar.` : `${a.nome} voltou a ter acesso.`); await carregar() } catch (e) { toast(e instanceof Error ? e.message : 'Não foi possível alterar.') }
  }
  const editar = (a: Acesso) => { setMsg(''); setForm({ id: a.id, nome: a.nome, email: a.email, tipo: a.tipo, unidades: a.unidades, enviarEmail: false }) }
  const marcar = (id: string) => setForm(f => f && ({ ...f, unidades: f.unidades.includes(id) ? f.unidades.filter(x => x !== id) : [...f.unidades, id] }))


  if (erro) return <Empty titulo="Não foi possível abrir os acessos" texto={erro} acao="Tentar de novo" onAcao={() => void carregar()} />
  if (!lista) return <p className="text-sm text-muted-foreground" role="status">Carregando acessos…</p>

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Quem pode entrar no sistema" actions={<Button onClick={() => { setMsg(''); setForm({ ...VAZIA, tipo: 'coordenador' }) }}><UserPlus size={15} />Novo acesso</Button>}>
        <p className="mb-3 max-w-prose text-sm text-muted-foreground">Cadastre aqui a equipe da Unidigit@l e as pessoas das unidades escolares. Cada pessoa recebe um link para criar a própria senha, e a Unidigit@l nunca precisa saber essa senha.</p>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {TIPOS.map(t => (
            <li key={t.id} className="rounded-md border bg-background p-3">
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${COR_TIPO[t.id]}`}>{t.nome}</span>
              <p className="mt-1.5 text-xs text-muted-foreground">{t.texto}</p>
            </li>
          ))}
        </ul>
      </Panel>

      {lista.usuarios.length === 0 ? <Empty titulo="Nenhum acesso cadastrado" texto="Crie o primeiro acesso para uma unidade escolar." acao="Novo acesso" onAcao={() => setForm({ ...VAZIA })} /> : (
        <Panel>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead><tr className="text-left"><th className="kicker pb-2 font-medium">Pessoa</th><th className="kicker pb-2 font-medium">Tipo</th><th className="kicker pb-2 font-medium">Unidades</th><th className="kicker pb-2 font-medium">Último acesso</th><th className="kicker pb-2 text-right font-medium">Ações</th></tr></thead>
              <tbody className="divide-y">
                {lista.usuarios.map(a => (
                  <tr key={a.id} className={a.ativo ? '' : 'opacity-60'}>
                    <td className="py-2 pr-3"><div className="font-medium">{a.nome}{a.voce && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(você)</span>}{!a.ativo && <span className="ml-1.5 rounded-full bg-bad-soft px-2 py-0.5 text-[11px] text-destructive">Desativado</span>}</div><div className="text-xs text-muted-foreground">{a.email} · usuário {a.login}</div></td>
                    <td className="py-2 pr-3"><span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${COR_TIPO[a.tipo]}`}>{a.protegido && a.tipo === 'equipe' ? 'Administrador do site' : NOME_TIPO[a.tipo]}</span></td>
                    <td className="py-2 pr-3 text-xs">{a.tipo === 'equipe' ? 'Todas' : a.unidades.map(nomeUnidade).join(', ') || '—'}</td>
                    <td className="mono py-2 pr-3 text-xs text-muted-foreground">{a.ultimoAcesso ? quando(a.ultimoAcesso) : 'Nunca entrou'}</td>
                    <td className="py-2 text-right">
                      {a.protegido ? <span className="text-xs text-muted-foreground">Gerenciado no painel do WordPress</span> : (
                        <span className="inline-flex flex-wrap justify-end gap-1">
                          <Button size="sm" variant="outline" onClick={() => editar(a)} disabled={a.tipo === 'equipe' && !podeEquipe}><Pencil size={13} />Editar</Button>
                          <Button size="sm" variant="outline" onClick={() => void novoLink(a)} disabled={!a.ativo || (a.tipo === 'equipe' && !podeEquipe)} title="Envia por e-mail um novo link temporário para criar ou trocar a senha"><KeyRound size={13} />Enviar acesso</Button>
                          {!a.voce && <Button size="sm" variant="ghost" className={a.ativo ? 'text-destructive' : ''} onClick={() => void alternar(a)} disabled={a.tipo === 'equipe' && !podeEquipe}><Power size={13} />{a.ativo ? 'Desativar' : 'Reativar'}</Button>}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <Panel title="Avisos por e-mail" actions={<Button variant="outline" onClick={() => void testarEmail()} disabled={testando}><Mail size={15} />{testando ? 'Enviando…' : 'Enviar e-mail de teste'}</Button>}>
        <p className="max-w-prose text-sm text-muted-foreground">Pedidos e mensagens sempre aparecem no sino do sistema. O e-mail é um reforço: se a hospedagem não entregar, o histórico da turma mostra “E-mail não enviado”. Use o teste para conferir se a caixa de entrada de <b>{me.nome}</b> recebe.</p>
        {teste && <p role="status" className={`mt-3 rounded-md px-3 py-2 text-sm ${teste.ok ? 'bg-ok-soft text-ok' : 'bg-bad-soft text-destructive'}`}>{teste.ok ? `O servidor aceitou o envio para ${teste.para}. Confira a caixa de entrada e o spam em alguns minutos.` : 'O servidor não conseguiu enviar o e-mail. Os avisos continuam no sino. Peça ao suporte da hospedagem para ativar o envio (SMTP).'}</p>}
      </Panel>

      <Dialog open={!!form} onOpenChange={o => { if (!o && !busy) setForm(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form?.id === null ? 'Novo acesso' : 'Editar acesso'}</DialogTitle><DialogDescription>{form?.id === null ? 'A pessoa recebe um link para criar a própria senha.' : 'Mudanças valem no próximo acesso da pessoa.'}</DialogDescription></DialogHeader>
          {form && (
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1"><span className="kicker">Nome</span><input className="field-input" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} /></label>
              <label className="flex flex-col gap-1"><span className="kicker">E-mail</span><input type="email" className="field-input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
              <label className="flex flex-col gap-1"><span className="kicker">Tipo de acesso</span>
                <select className="field-input" value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value as TipoAcesso })}>{tiposDisponiveis.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}</select>
                <span className="text-xs text-muted-foreground">{TIPOS.find(t => t.id === form.tipo)?.texto}</span></label>
              {form.tipo !== 'equipe' && (
                <fieldset className="flex flex-col gap-1.5"><legend className="kicker mb-1">Unidades que a pessoa acessa</legend>
                  {d.unidades.length === 0 && <p className="text-xs text-warn">Cadastre as unidades na aba Unidades antes de criar acessos para elas.</p>}
                  {d.unidades.map(u => <label key={u.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.unidades.includes(u.id)} onChange={() => marcar(u.id)} />{u.nome}{u.cidade ? ` · ${u.cidade}` : ''}</label>)}
                </fieldset>
              )}
              {form.id === null && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.enviarEmail} onChange={e => setForm({ ...form, enviarEmail: e.target.checked })} />Enviar o link temporário por e-mail</label>}
              {msg && <p role="alert" className="rounded-md bg-bad-soft px-3 py-2 text-sm text-destructive">{msg}</p>}
            </div>
          )}
          <DialogFooter className="gap-2"><Button variant="outline" onClick={() => setForm(null)} disabled={busy}>Cancelar</Button><Button onClick={() => void salvar()} disabled={busy || !form?.nome.trim() || !form?.email.trim()}>{form?.id === null ? 'Criar acesso' : 'Salvar'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
