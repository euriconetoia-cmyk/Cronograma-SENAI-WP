const { chromium } = require('/opt/node22/lib/node_modules/playwright')
;(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'}); const ctx=await b.newContext({viewport:{width:1500,height:1000}}); const p=await ctx.newPage()
 await p.goto('http://127.0.0.1:8099/wp-login.php'); await p.fill('#user_login','admin'); await p.fill('#user_pass','senha123'); await Promise.all([p.waitForNavigation(),p.click('#wp-submit')])
 const open=async()=>{ await p.goto('http://127.0.0.1:8099/?page_id=4'); await p.waitForSelector('header'); await p.waitForTimeout(1000); const s=p.locator('select.field-input').first(); const o=await s.locator('option').allInnerTexts(); await s.selectOption({label:o.find(x=>/Fluxo/.test(x))}); await p.waitForTimeout(800) }
 await open()
 const dates=async()=> (await p.locator('input[type=date]').evaluateAll(a=>a.map(x=>x.value))).slice(0,12)
 console.log('antes :', (await dates()).join(' '))
 await p.locator('input[type=date]').first().fill('2026-08-03'); await p.waitForTimeout(2500)
 console.log('depois:', (await dates()).join(' '))
 await open(); console.log('recarregou:', (await dates()).join(' '))
 await p.screenshot({path:'/tmp/wpt/real_inicio.png'})
 await b.close()})().catch(e=>{console.log('FALHOU',e.message);process.exit(1)})
