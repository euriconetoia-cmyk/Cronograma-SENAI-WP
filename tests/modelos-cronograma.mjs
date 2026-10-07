import assert from 'node:assert/strict'
import { compute, momentos } from '../ui/src/lib/schedule.ts'

const regras = { hEncontro: 8, webDias: 10, webHora: '15h', postDias: 3, horario: '08h às 17h' }
const turma = { inicio: '2026-03-02', unidadeId: 'u1', itens: {} }
const feriados = [['2026-03-19','Feriado local','u1']]
const mk = (modelo, itens, cfg = undefined) => ({ id:modelo, nome:modelo, modeloCronograma:modelo, configuracaoCronograma:cfg, chTotal:itens.reduce((s,i)=>s+((i.tipo==='uc'||i.tipo==='pratica')?i.ch:0),0), nota:'', regras, modulos:[{id:'m1',nome:'Módulo',itens}] })

const tecnico = mk('tecnico', [{id:'t1',tipo:'uc',nome:'UC Técnica',ch:40,pres:16,div:3}])
{
  const g=compute(turma,tecnico,feriados)
  assert.equal(g.rows[0].c.I,8)
  assert.equal(g.rows[0].c.nenc,2)
  assert.equal(g.rows[0].c.nsinc,0)
}

const qualificacao = mk('qualificacao', [{id:'q1',tipo:'uc',nome:'UC Qualificação',ch:30,pres:8,div:2}])
{
  const g=compute(turma,qualificacao,feriados)
  assert.equal(g.rows[0].c.I,11)
  assert.equal(g.rows[0].c.nenc,1)
}

const diario = mk('distribuicao_diaria', [{id:'d1',tipo:'uc',nome:'UC diária',ch:21,pres:0,div:99}], {cargaDiaria:3})
{
  const g=compute(turma,diario,feriados)
  assert.equal(g.rows[0].c.I,7)
  assert.equal(g.rows[0].c.nenc,0)
}

const aprendizagem = mk('aprendizagem', [
  {id:'a1',tipo:'uc',nome:'Gestão',ch:20,pres:0,div:2,sincronos:4},
  {id:'p1',tipo:'pratica',nome:'Prática Profissional na Empresa',ch:80,pres:0,div:8},
])
{
  const g=compute(turma,aprendizagem,feriados)
  assert.equal(g.rows[0].c.nsinc,11)
  assert.equal(momentos(turma,g.rows[0],aprendizagem).length,11)
  assert.equal(g.sumUC,100,'prática com carga deve compor a carga total do curso')
  assert.equal(g.nUC,1,'prática não deve aumentar a quantidade de UCs')
  assert.ok(g.rows[1].c.J>g.rows[0].c.K,'prática sequencial deve iniciar após a teoria')
}

console.log('modelos cronograma: Técnico, Qualificação, Distribuição Diária e Aprendizagem aprovados')
