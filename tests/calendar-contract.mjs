import fs from 'node:fs'
const fx = JSON.parse(fs.readFileSync(new URL('./calendar-fixtures.json', import.meta.url), 'utf8'))
const toN = s => { const p=s.split('-'); return Math.round(Date.UTC(+p[0],+p[1]-1,+p[2])/864e5) }
const toS = n => new Date(n*864e5).toISOString().slice(0,10)
const dow = n => new Date(n*864e5).getUTCDay()
function workday(s,n,hol){ let d=toN(s), left=n; const H=new Set(hol); while(left>0){d++; const w=dow(d); if(w===0||w===6||H.has(toS(d))) continue; left--} return toS(d) }
for(const c of fx){ const got=workday(c.start,c.days,c.holidays); if(got!==c.expected) throw new Error(`${c.id}: expected ${c.expected}, got ${got}`) }
console.log(`OK calendar-contract: ${fx.length} fixtures`)
