import assert from 'node:assert/strict'
import { compute, corrigirEncontros, sugerirEventos, momentos } from '../ui/src/lib/schedule.ts'

const feriados = [['2026-04-21', 'Tiradentes']]
const baseRules = { hEncontro: 8, webDias: 10, webHora: '15h', postDias: 3, horario: '08:00h às 17:00h' }
const turma = { inicio: '2026-04-20', unidadeId: 'u1', itens: {} }

const cursoAprendizagem = {
  id: 'apr', nome: 'Aprendizagem', chTotal: 22, nota: '', modeloCronograma: 'aprendizagem', regras: baseRules,
  modulos: [{ id: 'm1', nome: 'Módulo', itens: [{ id: 'i1', tipo: 'uc', nome: 'Recebimento', ch: 22, pres: 0, div: 2, sincronos: 5 }]}],
}
{
  const g = compute(turma, cursoAprendizagem, feriados)
  assert.equal(g.rows[0].c.nenc, 0, 'sem carga presencial não há encontro presencial')
  assert.equal(g.rows[0].c.nsinc, 5, 'síncronos são independentes da CH presencial')
  const ms = momentos(turma, g.rows[0], cursoAprendizagem)
  assert.equal(ms.length, 5)
  assert.ok(ms.every(x => x.tipo === 'sincrono'))
}

const cursoDiario = {
  id: 'dia', nome: 'Diário', chTotal: 18, nota: '', modeloCronograma: 'distribuicao_diaria',
  configuracaoCronograma: { cargaDiaria: 4 }, regras: baseRules,
  modulos: [{ id: 'm1', nome: 'Módulo', itens: [{ id: 'i1', tipo: 'uc', nome: 'UC', ch: 18, pres: 2, div: 99 }]}],
}
{
  const g = compute(turma, cursoDiario, feriados)
  assert.equal(g.rows[0].c.I, 4, '16h EaD distribuídas em 4h/dia')
}

{
  const datas = sugerirEventos('2026-04-20', '2026-05-08', 4, new Set(['2026-04-21']), [1,3])
  assert.deepEqual(datas, ['2026-04-20','2026-04-22','2026-04-27','2026-04-29'], 'deve respeitar seg/qua e feriado')
}

{
  const c = {
    id:'custom', nome:'Custom', chTotal:12, nota:'', modeloCronograma:'personalizado', regras:baseRules,
    configuracaoCronograma:{ diasEstudoPermitidos:[1,3,5], presencial:{ativo:true,modo:'quantidade',quantidade:1,diasPermitidos:[2],duracaoHoras:4}},
    modulos:[{id:'m1',nome:'M',itens:[{id:'i1',tipo:'uc',nome:'UC custom',ch:12,pres:4,div:2}]}],
  }
  const tt = { inicio:'2026-04-20', unidadeId:'u1', itens:{ i1:{ enc:[{d:'2026-04-22',h:'08h',w:'15h'}] } } }
  const g = compute(tt,c,[])
  assert.equal(g.rows[0].c.K,'2026-04-29','dias de estudo devem respeitar seg/qua/sex')
  const fix = corrigirEncontros(tt,g,[],new Set(['i1:0']))
  assert.equal(fix.i1[0].d,'2026-04-21','correção deve respeitar terça-feira configurada para presencial')
}

console.log('schedule multimodelo: 4 cenários aprovados')
