import assert from 'node:assert/strict'
import {
  resolverPerfilCronograma,
  diasEstudoItem,
  quantidadeEventosItem,
  diasPermitidosEvento,
} from '../ui/src/lib/scheduleProfiles.ts'

const item = (patch = {}) => ({ id: 'i1', tipo: 'uc', nome: 'UC', ch: 30, pres: 6, div: 3, ...patch })
const curso = (patch = {}) => ({
  id: 'c1', nome: 'Curso', chTotal: 30, nota: '',
  regras: { hEncontro: 6, webDias: 10, webHora: '15h', postDias: 3, horario: '08:00h às 14:00h' },
  modulos: [], ...patch,
})

{
  const p = resolverPerfilCronograma(curso())
  assert.equal(p.modelo, 'qualificacao', 'curso legado deve assumir qualificação')
  assert.deepEqual(p.presencial.diasPermitidos, [6], 'legado deve preservar sábado')
  assert.equal(p.sincrono.ativo, false)
}

{
  const p = resolverPerfilCronograma(curso({ modeloCronograma: 'tecnico' }))
  assert.equal(p.modelo, 'tecnico')
  assert.equal(p.presencial.modo, 'carga')
}

{
  const c = curso({ modeloCronograma: 'distribuicao_diaria', configuracaoCronograma: { cargaDiaria: 4 } })
  assert.equal(diasEstudoItem(item({ ch: 18, pres: 2, div: 99 }), c), 4, '16h EaD / 4h deve gerar 4 dias')
}

{
  const c = curso({ modeloCronograma: 'aprendizagem' })
  const i = item({ ch: 22, pres: 0, sincronos: 5 })
  assert.equal(quantidadeEventosItem(i, c, 'sincrono'), 5, 'aprendizagem aceita síncronos com CH presencial zero')
  assert.equal(quantidadeEventosItem(i, c, 'presencial'), 0)
  assert.deepEqual(diasPermitidosEvento(i, c, 'sincrono'), [1,2,3,4,5])
}

{
  const c = curso({ modeloCronograma: 'aprendizagem', configuracaoCronograma: { sincrono: { ativo: true, modo: 'quantidade', quantidade: 2, diasPermitidos: [2,4] } } })
  const i = item({ sincronos: 7, configuracaoCronograma: { sincrono: { quantidade: 3, diasPermitidos: [1,3] } } })
  assert.equal(quantidadeEventosItem(i, c, 'sincrono'), 3, 'UC sobrescreve quantidade do curso')
  assert.deepEqual(diasPermitidosEvento(i, c, 'sincrono'), [1,3], 'UC sobrescreve dias do curso')
}

{
  const c = curso({ modeloCronograma: 'personalizado', configuracaoCronograma: { presencial: { ativo: true, modo: 'quantidade', quantidade: 4, diasPermitidos: [] } } })
  assert.equal(quantidadeEventosItem(item({ pres: 0 }), c, 'presencial'), 4)
  assert.deepEqual(diasPermitidosEvento(item(), c, 'presencial'), [6], 'lista vazia usa default seguro')
}

console.log('schedule profiles: 6 cenários aprovados')
