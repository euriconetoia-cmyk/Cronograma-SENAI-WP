import { useState } from 'react'
import { toast } from 'sonner'
import { ArrowDown, ArrowLeft, ArrowUp, Copy, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Confirm, Field, Panel, uid, type ConfirmCopy } from '@/components/Fields'
import { useStore } from '@/lib/store'
import { T } from '@/lib/texts'
import type { Curso, Item, ModeloCronograma, Tipo } from '@/lib/types'
import { diasEstudoItem, resolverPerfilCronograma } from '@/lib/scheduleProfiles'

const TIPOS: [Tipo, string][] = [['intro', 'Introdutório'], ['uc', 'UC'], ['rec', 'Recuperação'], ['mat', 'Matrícula'], ['pratica', 'Prática profissional']]
const ROW: Record<Tipo, string> = { intro: 'bg-row-intro', uc: 'bg-card', rec: 'bg-row-rec', mat: 'bg-row-intro', pratica: 'bg-row-intro' }
const novoItem = (tipo: Tipo): Item => ({ id: uid('i'), tipo, nome: tipo === 'mat' ? 'Matrícula' : tipo === 'rec' ? 'Recuperação UC' : tipo === 'pratica' ? 'Prática Profissional na Empresa' : 'Nova unidade curricular', ch: tipo === 'uc' ? 60 : tipo === 'pratica' ? 0 : 15, pres: tipo === 'uc' ? 12 : 0, div: 3, sincronos: 0 })
const MODELOS: [ModeloCronograma, string][] = [['tecnico', 'Técnico'], ['qualificacao', 'Qualificação'], ['distribuicao_diaria', 'Distribuição diária'], ['aprendizagem', 'Aprendizagem'], ['personalizado', 'Personalizado']]
const parseDias = (v: string) => v.split(',').map(x => +x.trim()).filter(x => Number.isInteger(x) && x >= 0 && x <= 6)

export function CursosPage() {
  const { d, update, cursoId, setCursoId } = useStore()
  const [detalhe, setDetalhe] = useState(false) // no celular: lista ou detalhe
  const [confirma, setConfirma] = useState<{ copy: ConfirmCopy; run: () => void } | null>(null)
  const c = d.cursos.find(x => x.id === cursoId) || d.cursos[0]
  const mut = (fn: (c: Curso) => void) => update(x => { fn(x.cursos.find(a => a.id === c.id)!) })

  const novo = () => {
    const n: Curso = { id: uid('c'), nome: 'Novo curso', categoria: '', modalidade: '', modeloCronograma: 'qualificacao', chTotal: 0, nota: '', regras: { hEncontro: 8, webDias: 10, webHora: '15h', postDias: 3, horario: '08:00h às 17:00h' }, modulos: [{ id: uid('m'), nome: 'Módulo 1', itens: [] }] }
    update(x => { x.cursos.push(n) }); setCursoId(n.id)
  }
  const duplicar = () => { const n: Curso = JSON.parse(JSON.stringify(c)); n.id = uid('c'); n.nome = `${c.nome} (cópia)`; n.modulos.forEach(m => { m.id = uid('m'); m.itens.forEach(i => { i.id = uid('i') }) }); update(x => { x.cursos.push(n) }); setCursoId(n.id); toast('Curso duplicado.') }
  const excluir = () => {
    if (d.turmas.some(t => t.cursoId === c.id)) { toast(T.cursos.emUso); return }
    setConfirma({ copy: T.cursos.confirmaCurso(c.nome), run: () => update(x => { x.cursos = x.cursos.filter(a => a.id !== c.id) }) })
  }
  const mover = <A,>(arr: A[], i: number, dir: number) => { const j = i + dir; if (j < 0 || j >= arr.length) return; const [x] = arr.splice(i, 1); arr.splice(j, 0, x) }

  if (!c) return <Panel><p className="text-sm text-muted-foreground">Nenhum curso cadastrado.</p><Button className="mt-3" onClick={novo}>{T.cursos.novo}</Button></Panel>
  const soma = c.modulos.reduce((s, m) => s + m.itens.filter(i => i.tipo === 'uc' || i.tipo === 'pratica').reduce((a, i) => a + (+i.ch || 0), 0), 0)
  const chOk = soma === +c.chTotal

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(240px,300px)_minmax(0,1fr)]">
      <Panel className={detalhe ? 'max-md:hidden' : ''} title={T.cursos.titulo} actions={<Button size="sm" onClick={novo}><Plus size={14} />{T.cursos.novo}</Button>}>
        <ul className="flex flex-col gap-1.5">
          {d.cursos.map(x => {
            const n = x.modulos.reduce((s, m) => s + m.itens.filter(i => i.tipo === 'uc').length, 0)
            return <li key={x.id}><button onClick={() => { setCursoId(x.id); setDetalhe(true) }} aria-current={x.id === c.id} className={`min-h-[56px] w-full rounded-lg border px-3 py-2 text-left ${x.id === c.id ? 'border-primary bg-accent' : 'bg-card hover:border-primary'}`}><span className="block font-medium">{x.nome}</span><span className="text-xs text-muted-foreground">{[x.categoria && T.categoria[x.categoria]?.nome, x.modalidade && T.modalidade[x.modalidade]].filter(Boolean).join(' · ')}{x.categoria || x.modalidade ? ' · ' : ''}{n} UCs · {x.chTotal} h</span></button></li>
          })}
        </ul>
      </Panel>

      <div className={`flex min-w-0 flex-col gap-4 ${detalhe ? '' : 'max-md:hidden'}`}>
        <button type="button" onClick={() => setDetalhe(false)} className="inline-flex min-h-[44px] items-center gap-1.5 self-start text-sm font-semibold text-primary md:hidden"><ArrowLeft size={16} />Voltar para os cursos</button>
        <Panel title={T.cursos.dados} actions={<>
          <Button size="sm" variant="outline" onClick={duplicar}><Copy size={14} />Duplicar</Button>
          <Button size="sm" variant="outline" className="text-destructive" onClick={excluir}><Trash2 size={14} />Excluir curso</Button>
        </>}>
          <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
            <Field label="Nome do curso"><input className="field-input" value={c.nome} onChange={e => mut(k => { k.nome = e.target.value })} /></Field>
            <Field label="Categoria do curso"><select className="field-input" value={c.categoria ?? ''} onChange={e => mut(k => { k.categoria = e.target.value as Curso['categoria'] })}>
              <option value="">Não informada</option>
              {T.categoriaGrupos.map(g => <optgroup key={g.nome} label={g.nome}>{g.itens.map(k => <option key={k} value={k}>{T.categoria[k].nome}</option>)}</optgroup>)}
            </select></Field>
            <Field label="Modalidade (como é oferecido)"><select className="field-input" value={c.modalidade ?? ''} onChange={e => mut(k => { k.modalidade = e.target.value as Curso['modalidade'] })}>
              <option value="">Não informada</option>
              {Object.entries(T.modalidadeLonga).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></Field>
            <Field label="Modelo do cronograma"><select className="field-input" value={c.modeloCronograma ?? 'qualificacao'} onChange={e => mut(k => { k.modeloCronograma = e.target.value as ModeloCronograma })}>
              {MODELOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select></Field>
            <Field label="Carga horária total (h)"><input type="number" min={0} className="field-input mono" value={c.chTotal} onChange={e => mut(k => { k.chTotal = +e.target.value })} /></Field>
            <Field label="Nota de rodapé do cronograma"><input className="field-input" value={c.nota} onChange={e => mut(k => { k.nota = e.target.value })} /></Field>
          </div>
          {c.categoria && (() => {
            const cat = T.categoria[c.categoria], ch = +c.chTotal
            const fora = (cat.min && ch > 0 && ch < cat.min) ? `A referência para esta categoria é de pelo menos ${cat.min} h, e o curso tem ${ch} h.` : (cat.max && ch > cat.max) ? `A referência para esta categoria é de até ${cat.max} h, e o curso tem ${ch} h.` : ''
            return <p className={`mt-3 text-sm ${fora ? 'text-warn' : 'text-muted-foreground'}`}><b>{cat.nome}:</b> {cat.desc}{fora && <> <b>Atenção: {fora}</b></>}</p>
          })()}
          <div className={`mt-3 rounded-md px-3 py-2 text-sm ${chOk ? 'bg-ok-soft text-ok' : 'bg-bad-soft text-destructive'}`}>{chOk ? T.cursos.chOk(soma, +c.chTotal) : T.cursos.chErro(soma, +c.chTotal)}</div>
        </Panel>

        <Panel title={T.cursos.regras}>
          <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
            <Field label="Horas por encontro presencial"><input type="number" min={1} className="field-input mono" value={c.regras.hEncontro} onChange={e => mut(k => { k.regras.hEncontro = +e.target.value })} /></Field>
            <Field label="Horário padrão dos encontros"><input className="field-input" value={c.regras.horario} onChange={e => mut(k => { k.regras.horario = e.target.value })} /></Field>
            <Field label="Webconferência: dias antes do encontro"><input type="number" min={0} className="field-input mono" value={c.regras.webDias} onChange={e => mut(k => { k.regras.webDias = +e.target.value })} /></Field>
            <Field label="Webconferência: hora"><input className="field-input" value={c.regras.webHora} onChange={e => mut(k => { k.regras.webHora = e.target.value })} /></Field>
            <Field label="Postagem de notas: dias úteis depois"><input type="number" min={0} className="field-input mono" value={c.regras.postDias} onChange={e => mut(k => { k.regras.postDias = +e.target.value })} /></Field>
            {(c.modeloCronograma === 'distribuicao_diaria' || c.modeloCronograma === 'personalizado') && <Field label="Carga diária para distribuição (h)"><input type="number" min={0.5} step={0.5} className="field-input mono" value={c.configuracaoCronograma?.cargaDiaria ?? 3} onChange={e => mut(k => { k.configuracaoCronograma = { ...(k.configuracaoCronograma || {}), cargaDiaria: +e.target.value } })} /></Field>}
            {(c.modeloCronograma === 'aprendizagem' || c.modeloCronograma === 'personalizado') && <>
              <Field label="Duração padrão do momento síncrono (h)"><input type="number" min={0.5} step={0.5} className="field-input mono" value={c.configuracaoCronograma?.sincrono?.duracaoHoras ?? 2} onChange={e => mut(k => { k.configuracaoCronograma = { ...(k.configuracaoCronograma || {}), sincrono: { ...(k.configuracaoCronograma?.sincrono || {}), ativo: true, modo: 'quantidade', duracaoHoras: +e.target.value } } })} /></Field>
              <Field label="Dias permitidos para síncrono (0=dom ... 6=sáb)"><input className="field-input mono" value={(c.configuracaoCronograma?.sincrono?.diasPermitidos ?? [1,2,3,4,5]).join(',')} onChange={e => mut(k => { k.configuracaoCronograma = { ...(k.configuracaoCronograma || {}), sincrono: { ...(k.configuracaoCronograma?.sincrono || {}), ativo: true, modo: 'quantidade', diasPermitidos: parseDias(e.target.value) } } })} /></Field>
            </>}
          </div>
          <p className="mt-3 max-w-prose text-xs leading-relaxed text-muted-foreground">Perfil ativo: <b>{MODELOS.find(x => x[0] === (c.modeloCronograma ?? 'qualificacao'))?.[1]}</b>. {c.modeloCronograma === 'aprendizagem' ? 'Momentos síncronos são independentes da carga presencial e podem ser informados por UC.' : c.modeloCronograma === 'distribuicao_diaria' ? 'Os dias de estudo são calculados pela carga diária configurada.' : 'O comportamento atual de EaD e encontros presenciais é preservado.'}</p>
        </Panel>

        {c.modulos.map((m, mi) => (
          <section key={m.id} className="overflow-hidden rounded-lg border bg-card shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-row-mod px-3 py-2">
              <input aria-label="Nome do módulo" className="cell-input max-w-xs font-heading text-[15px] font-semibold" value={m.nome} onChange={e => mut(k => { k.modulos[mi].nome = e.target.value })} />
              <div className="flex flex-wrap items-center gap-1.5">
                <Button size="sm" variant="outline" onClick={() => mut(k => { k.modulos[mi].itens.push(novoItem('uc')) })}><Plus size={13} />{T.cursos.addUC}</Button>
                <Button size="sm" variant="outline" onClick={() => mut(k => { k.modulos[mi].itens.push(novoItem('rec')) })}><Plus size={13} />{T.cursos.addRec}</Button>
                <Button size="sm" variant="outline" onClick={() => mut(k => { k.modulos[mi].itens.push(novoItem('mat')) })}><Plus size={13} />{T.cursos.addMat}</Button>
                {(c.modeloCronograma === 'aprendizagem' || c.modeloCronograma === 'personalizado') && <Button size="sm" variant="outline" onClick={() => mut(k => { k.modulos[mi].itens.push(novoItem('pratica')) })}><Plus size={13} />Prática</Button>}
                <Button size="icon" variant="ghost" aria-label="Subir módulo" disabled={mi === 0} onClick={() => mut(k => mover(k.modulos, mi, -1))}><ArrowUp size={15} /></Button>
                <Button size="icon" variant="ghost" aria-label="Descer módulo" disabled={mi === c.modulos.length - 1} onClick={() => mut(k => mover(k.modulos, mi, 1))}><ArrowDown size={15} /></Button>
                <Button size="icon" variant="ghost" className="text-destructive" aria-label="Excluir módulo" onClick={() => setConfirma({ copy: T.cursos.confirmaModulo(m.nome), run: () => mut(k => { k.modulos.splice(mi, 1) }) })}><Trash2 size={15} /></Button>
              </div>
            </div>
            <div className="flex flex-col gap-2.5 p-3 md:hidden">
              {m.itens.length === 0 && <p className="text-sm text-muted-foreground">{T.cursos.semUso}</p>}
              {m.itens.map((it, ii) => {
                const H = (+it.ch || 0) - (+it.pres || 0), I = diasEstudoItem(it, c)
                const setIt = (p: Partial<Item>) => mut(k => { Object.assign(k.modulos[mi].itens[ii], p) })
                const num = 'field-input mono min-h-[44px]'
                return (
                  <article key={it.id} className={`rounded-xl border p-3 ${ROW[it.tipo]}`}>
                    <div className="grid gap-2.5">
                      <Field label="Tipo"><select className="field-input min-h-[44px]" value={it.tipo} onChange={e => setIt({ tipo: e.target.value as Tipo })}>{TIPOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
                      <Field label="Nome"><input className="field-input min-h-[44px] font-medium" value={it.nome} onChange={e => setIt({ nome: e.target.value })} /></Field>
                      <div className="grid grid-cols-2 gap-2.5">
                        <Field label="CH total"><input type="number" min={0} inputMode="numeric" className={num} value={it.ch} onChange={e => setIt({ ch: +e.target.value })} /></Field>
                        <Field label="CH presencial"><input type="number" min={0} inputMode="numeric" className={num} value={it.pres} onChange={e => setIt({ pres: +e.target.value })} /></Field>
                        <Field label="Divisor"><input type="number" min={0.5} step={0.5} inputMode="decimal" className={num} value={it.div} onChange={e => setIt({ div: +e.target.value })} /></Field>
                        {(c.modeloCronograma === 'aprendizagem' || resolverPerfilCronograma(c).sincrono.ativo) && it.tipo === 'uc' && <Field label="Momentos síncronos"><input type="number" min={0} inputMode="numeric" className={num} value={it.sincronos ?? 0} onChange={e => setIt({ sincronos: +e.target.value })} /></Field>}
                        <div className="flex flex-col justify-end text-sm"><span className="kicker">Calculado</span><span className="mono min-h-[44px] pt-2.5">{H} h a distância · {I} dias</span></div>
                      </div>
                    </div>
                    <div className="mt-2 flex justify-end gap-1">
                      <Button size="icon" variant="ghost" aria-label="Subir" disabled={ii === 0} onClick={() => mut(k => mover(k.modulos[mi].itens, ii, -1))}><ArrowUp size={16} /></Button>
                      <Button size="icon" variant="ghost" aria-label="Descer" disabled={ii === m.itens.length - 1} onClick={() => mut(k => mover(k.modulos[mi].itens, ii, 1))}><ArrowDown size={16} /></Button>
                      <Button size="icon" variant="ghost" className="text-destructive" aria-label={`Remover ${it.nome}`} onClick={() => mut(k => { k.modulos[mi].itens.splice(ii, 1) })}><Trash2 size={16} /></Button>
                    </div>
                  </article>
                )
              })}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[720px] text-[13px]">
                <thead><tr className="border-b text-left">{['Tipo', 'Nome', 'CH total', 'CH pres.', 'CH dist.', 'Divisor', 'Dias EaD', 'Síncronos', ''].map(h => <th key={h} className="kicker px-2 py-1.5 font-medium">{h}</th>)}</tr></thead>
                <tbody>
                  {m.itens.length === 0 && <tr><td colSpan={9} className="px-3 py-4 text-sm text-muted-foreground">{T.cursos.semUso}</td></tr>}
                  {m.itens.map((it, ii) => {
                    const H = (+it.ch || 0) - (+it.pres || 0), I = diasEstudoItem(it, c)
                    const setIt = (p: Partial<Item>) => mut(k => { Object.assign(k.modulos[mi].itens[ii], p) })
                    return (
                      <tr key={it.id} className={`border-b ${ROW[it.tipo]}`}>
                        <td className="px-1 py-1"><select className="cell-input w-[118px]" value={it.tipo} onChange={e => setIt({ tipo: e.target.value as Tipo })}>{TIPOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></td>
                        <td className="min-w-[260px] px-1"><input className="cell-input font-medium" value={it.nome} onChange={e => setIt({ nome: e.target.value })} /></td>
                        <td className="px-1"><input type="number" min={0} className="cell-input mono w-[72px] text-right" value={it.ch} onChange={e => setIt({ ch: +e.target.value })} /></td>
                        <td className="px-1"><input type="number" min={0} className="cell-input mono w-[72px] text-right" value={it.pres} onChange={e => setIt({ pres: +e.target.value })} /></td>
                        <td className="mono px-2 text-right">{H}</td>
                        <td className="px-1"><input type="number" min={0.5} step={0.5} className="cell-input mono w-[64px] text-right" value={it.div} onChange={e => setIt({ div: +e.target.value })} /></td>
                        <td className="mono px-2 text-right">{I}</td>
                        <td className="px-1">{it.tipo === 'uc' && (c.modeloCronograma === 'aprendizagem' || resolverPerfilCronograma(c).sincrono.ativo) ? <input type="number" min={0} className="cell-input mono w-[72px] text-right" value={it.sincronos ?? 0} onChange={e => setIt({ sincronos: +e.target.value })} aria-label={`Momentos síncronos de ${it.nome}`} /> : <span className="mono px-2 text-muted-foreground">—</span>}</td>
                        <td className="whitespace-nowrap px-1 text-right">
                          <Button size="icon" variant="ghost" aria-label="Subir" disabled={ii === 0} onClick={() => mut(k => mover(k.modulos[mi].itens, ii, -1))}><ArrowUp size={14} /></Button>
                          <Button size="icon" variant="ghost" aria-label="Descer" disabled={ii === m.itens.length - 1} onClick={() => mut(k => mover(k.modulos[mi].itens, ii, 1))}><ArrowDown size={14} /></Button>
                          <Button size="icon" variant="ghost" className="text-destructive" aria-label={`Remover ${it.nome}`} onClick={() => mut(k => { k.modulos[mi].itens.splice(ii, 1) })}><Trash2 size={14} /></Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))}
        <div><Button variant="outline" onClick={() => mut(k => { k.modulos.push({ id: uid('m'), nome: 'Novo módulo', itens: [] }) })}><Plus size={14} />{T.cursos.addModulo}</Button></div>
      </div>
      <Confirm copy={confirma?.copy ?? null} onClose={() => setConfirma(null)} onConfirm={() => confirma?.run()} />
    </div>
  )
}
