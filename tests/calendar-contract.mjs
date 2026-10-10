import fs from 'node:fs'
import assert from 'node:assert/strict'
import { workday } from '../ui/src/lib/schedule.ts'

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
console.log(`OK calendar-contract: ${fx.length + localCases.length} cenários usando schedule.ts`)
