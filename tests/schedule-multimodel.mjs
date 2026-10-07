import assert from 'node:assert/strict'
import { compute, corrigirEncontros, sugerirEventos, momentos, planejarSincronicos, fimFaseIntensivaAprendizagem } from '../ui/src/lib/schedule.ts'

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
  assert.equal(g.rows[0].c.nsinc, 12, 'Aprendizagem gera webaulas pela regra de atendimento, independentemente da CH presencial')
  const ms = momentos(turma, g.rows[0], cursoAprendizagem)
  assert.equal(ms.length, 12)
  const plano = planejarSincronicos(turma, g, feriados, false)
  assert.equal(plano.i1[0].d, '2026-04-20')
  assert.equal(plano.i1[1].d, '2026-04-22', 'feriado deve ser pulado')
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


{
  const c = {
    id:'apr-doc', nome:'Aprendizagem documento', chTotal:40, nota:'', modeloCronograma:'aprendizagem', regras:baseRules,
    configuracaoCronograma:{ aprendizagem:{ faseIntensivaDiasUteis:23, diasIntensivos:[1,2,3,4,5], diasAtendimentoRegular:[1,2], horarioWebaula:'13:30 às 17:00' } },
    modulos:[{id:'m1',nome:'M',itens:[
      {id:'u1',tipo:'uc',nome:'Intensiva',ch:20,pres:0,div:4},
      {id:'u2',tipo:'uc',nome:'Semanal',ch:20,pres:0,div:1.8},
    ]}],
  }
  const tt={inicio:'2026-10-14',unidadeId:'u1',itens:{}}
  const hs=[['2026-11-02','Finados'],['2026-11-15','Proclamação']]
  const g=compute(tt,c,hs)
  const hol=new Set(hs.map(x=>x[0]))
  assert.equal(fimFaseIntensivaAprendizagem(tt.inicio,c,hol),'2026-11-16','23 dias úteis devem encerrar a fase intensiva em 16/11/2026')
  const plano=planejarSincronicos(tt,g,hs,false)
  assert.ok(plano.u1.every(x => ['1','2','3','4','5'].includes(String(new Date(x.d+'T00:00:00Z').getUTCDay()))),'fase intensiva usa dias úteis')
  assert.ok(plano.u2.filter(x=>x.d>'2026-11-16').every(x => [1,2].includes(new Date(x.d+'T00:00:00Z').getUTCDay())),'fase semanal deve usar somente segunda e terça')
}

console.log('schedule multimodelo: 5 cenários aprovados')
