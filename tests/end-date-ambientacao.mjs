import assert from 'node:assert/strict'
import { compute, simularRecalculoPeriodo, workdayPermitidos } from '../ui/src/lib/schedule.ts'
import { resolverPerfilItem } from '../ui/src/lib/scheduleProfiles.ts'

const regras = { hEncontro: 8, webDias: 10, webHora: '15h', postDias: 3, horario: '08h às 17h' }
const turma = { inicio: '2026-03-02', unidadeId: 'u1', itens: {} }
const feriados = [['2026-03-19', 'Feriado local', 'u1']]
for (const modelo of ['tecnico', 'qualificacao', 'distribuicao_diaria', 'aprendizagem', 'personalizado']) {
  const itens = [
    { id:'ambient', tipo:'intro', nome:'Ambientação', ch:0, pres:0, div:0 },
    { id:'a', tipo:'uc', nome:'UC 1', ch:40, pres:0, div:4 },
    { id:'b', tipo:'uc', nome:'UC 2', ch:40, pres:0, div:4 }
  ]
  const curso = { id:modelo, nome:modelo, chTotal:80, modeloCronograma:modelo, regras,
    modulos:[{ id:'m', nome:'Módulo', itens }] }
  const base = compute(turma,curso,feriados)
  assert.equal(base.sumUC,80,modelo+' Ambientação não pode somar horas')
  assert.equal(base.nUC,2,modelo+' Ambientação não pode somar como UC curricular')
  assert.equal(base.rows[0].it.nome,'Ambientação')
  const ultimo = base.rows.at(-1)
  const dias = resolverPerfilItem(ultimo.it,curso).diasEstudoPermitidos
  const alvo = workdayPermitidos(base.end,3,new Set(feriados.map(f=>f[0])),dias)
  const sim = simularRecalculoPeriodo(turma,curso,feriados,alvo)
  assert.equal(sim.ok,true,modelo+' deve aceitar folga viável')
  assert.equal(sim.plano.end,alvo)
  assert.equal(sim.plano.sumUC,80)
  const itensSalvos = { b:{inicioPlanejado:sim.plano.rows.at(-1).c.J} }
  assert.equal(compute({...turma,itens:itensSalvos},curso,feriados).end,alvo,
    modelo+' o término precisa sobreviver à recomputação com dados persistidos')
  const impossivel = simularRecalculoPeriodo(turma,curso,feriados,'2026-03-03')
  assert.equal(impossivel.ok,false,modelo+' não pode comprimir carga horária')
  const invertido = simularRecalculoPeriodo(turma,curso,feriados,'2026-02-01')
  assert.equal(invertido.ok,false,modelo+' deve rejeitar término anterior ao início')
  assert.equal(compute({...turma,itens:{ambient:{inicioPlanejado:'2026-03-04'}}},curso,feriados).rows[0].c.J,'2026-03-04',
    modelo+' Ambientação pode ter data manual')
}
console.log('Recálculo conservador e Ambientação zero-hora: cinco modelos verificados')
