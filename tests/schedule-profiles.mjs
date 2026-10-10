import assert from 'node:assert/strict'
import {
  resolverPerfilCronograma,
  diasEstudoItem,
  quantidadeEventosItem,
  diasPermitidosEvento,
  aplicarConfiguracaoTurma,
  validarConfiguracaoModelo,
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

{
  const base = curso({ modeloCronograma: 'aprendizagem', configuracaoCronograma: { aprendizagem: { faseIntensivaDiasUteis: 23, diasAtendimentoRegular: [1,2] } } })
  const efetivo = aplicarConfiguracaoTurma(base, { personalizarCronograma: true, configuracaoCronograma: { aprendizagem: { faseIntensivaDiasUteis: 10, diasAtendimentoRegular: [3] } } })
  const p = resolverPerfilCronograma(efetivo)
  assert.equal(p.aprendizagem?.faseIntensivaDiasUteis, 10, 'turma deve sobrescrever somente a fase intensiva')
  assert.deepEqual(p.aprendizagem?.diasAtendimentoRegular, [3], 'turma deve sobrescrever dias semanais')
  assert.deepEqual(p.aprendizagem?.diasIntensivos, [1,2,3,4,5], 'campos não sobrescritos devem continuar herdados do preset')
}

{
  const base = curso({ modeloCronograma: 'distribuicao_diaria', configuracaoCronograma: { cargaDiaria: 4 } })
  const efetivo = aplicarConfiguracaoTurma(base, { personalizarCronograma: false, configuracaoCronograma: { cargaDiaria: 6 } })
  assert.equal(resolverPerfilCronograma(efetivo).cargaDiaria, 4, 'override desligado não deve alterar o curso')
}

{
  const c = curso({ modeloCronograma: 'aprendizagem', configuracaoCronograma: { aprendizagem: { faseIntensivaDiasUteis: 23, diasAtendimentoRegular: [] } } })
  assert.equal(validarConfiguracaoModelo(c).length, 0, 'lista vazia explícita usa fallback seguro do perfil')
}


for (const modelo of ['tecnico','qualificacao','distribuicao_diaria','aprendizagem','personalizado']) {
  const base = curso({modeloCronograma:modelo})
  const antes = diasPermitidosEvento(item(),base,'presencial')
  const efetivo = aplicarConfiguracaoTurma(base,{personalizarCronograma:true,configuracaoCronograma:{
    presencial:{diasPermitidos:[2,4]},sincrono:{diasPermitidos:[1,3]},diasEstudoPermitidos:[1,2,3,4]
  }})
  assert.deepEqual(diasPermitidosEvento(item(),efetivo,'presencial'),[2,4],modelo+' deve permitir terça e quinta presenciais na turma')
  assert.deepEqual(diasPermitidosEvento(item(),efetivo,'sincrono'),[1,3],modelo+' deve permitir dias síncronos específicos')
  assert.deepEqual(resolverPerfilCronograma(efetivo).diasEstudoPermitidos,[1,2,3,4])
  assert.deepEqual(diasPermitidosEvento(item(),base,'presencial'),antes,modelo+' não pode alterar o curso original')
}

console.log('schedule profiles: 9 cenários + personalização semanal dos cinco modelos aprovados')
