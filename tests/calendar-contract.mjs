import fs from 'node:fs'
import assert from 'node:assert/strict'
import { workday, feriadosDaTurma } from '../ui/src/lib/schedule.ts'

// Validar a função REAL do aplicativo, não duplicar a implementação no teste.
const fx = JSON.parse(fs.readFileSync(new URL('./calendar-fixtures.json', import.meta.url), 'utf8'))
for (const c of fx) {
  const got = workday(c.start, c.days, new Set(c.holidays))
  assert.equal(got, c.expected, `${c.id}: esperado ${c.expected}; obtido ${got}`)
}

// Cobertura adicional: feriados de qualquer abrangência recebidos da unidade
// devem bloquear o dia apenas quando presentes na lista aplicável à turma.
const localCases = [
  { id: 'CAL-LOCAL-001', start: '2026-10-08', days: 1, holidays: ['2026-10-09'], expected: '2026-10-12' },
  { id: 'CAL-LOCAL-002', start: '2026-10-08', days: 1, holidays: [], expected: '2026-10-09' },
  { id: 'CAL-LOCAL-003', start: '2026-10-09', days: 1, holidays: ['2026-10-12'], expected: '2026-10-13' },
  { id: 'CAL-LOCAL-004', start: '2026-10-09', days: 1, holidays: [], expected: '2026-10-12' },
]
for (const c of localCases) {
  assert.equal(workday(c.start, c.days, new Set(c.holidays)), c.expected, c.id)
}
// Valida a filtragem territorial REAL antes de calcular o calendário de cada unidade.
const territoriais = [
  ['2026-10-09', 'Feriado geral'],
  ['2026-10-12', 'Feriado da unidade A', 'unidade-a'],
  ['2026-10-13', 'Feriado da unidade B', 'unidade-b'],
]
const a = feriadosDaTurma({ unidadeId: 'unidade-a' }, territoriais)
const b = feriadosDaTurma({ unidadeId: 'unidade-b' }, territoriais)
assert.deepEqual(a.map(x => x[0]), ['2026-10-09', '2026-10-12'], 'A deve incluir geral e local A')
assert.deepEqual(b.map(x => x[0]), ['2026-10-09', '2026-10-13'], 'B deve incluir geral e local B')
assert.equal(workday('2026-10-08', 1, new Set(a.map(x => x[0]))), '2026-10-13', 'A pula geral e local A')
assert.equal(workday('2026-10-08', 1, new Set(b.map(x => x[0]))), '2026-10-12', 'B não é afetada pelo feriado local A')
console.log(`OK calendar-contract: ${fx.length + localCases.length} cenários de cálculo + 2 cenários de escopo territorial usando schedule.ts`)
