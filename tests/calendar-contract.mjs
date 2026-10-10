import fs from 'node:fs'
import assert from 'node:assert/strict'
import { workday } from '../ui/src/lib/schedule.ts'

// Validar a função REAL do aplicativo, não duplicar a implementação no teste.
const fx = JSON.parse(fs.readFileSync(new URL('./calendar-fixtures.json', import.meta.url), 'utf8'))
for (const c of fx) {
  const got = workday(c.start, c.days, new Set(c.holidays))
  assert.equal(got, c.expected, `${c.id}: esperado ${c.expected}; obtido ${got}`)
}
console.log(`OK calendar-contract: ${fx.length} fixtures usando schedule.ts`)
