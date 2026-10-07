const { chromium } = require('/opt/node22/lib/node_modules/playwright')
;(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'})
 const login=async(u)=>{ const ctx=await b.newContext({viewport:{width:1500,height:1100}}); const p=await ctx.newPage(); await p.goto('http://127.0.0.1:8099/wp-login.php'); await p.fill('#user_login',u); await p.fill('#user_pass','senha123'); await Promise.all([p.waitForNavigation(),p.click('#wp-submit')]); return p }
 const abrir=async(p)=>{ await p.goto('http://127.0.0.1:8099/?page_id=4'); await p.waitForSelector('header'); await p.waitForTimeout(900); const s=p.locator('select.field-input').first(); const o=await s.locator('option').allInnerTexts(); await s.selectOption({label:o.find(x=>/Fluxo/.test(x))}); await p.waitForTimeout(700) }
 const dadosTab=async p=>{ await p.getByRole('tab',{name:/Dados da turma/}).click(); await p.waitForTimeout(300) }
 const ini=p=>p.locator('#dados-turma input[type=date]')
 const clique=async(p,re)=>{ await p.locator('button',{hasText:re}).first().click(); await p.waitForTimeout(400) }
 // unidade valida
 const u=await login('coord_itb'); await abrir(u); await dadosTab(u)
 console.log('UNIDADE início desabilitado:', await ini(u).isDisabled(), '| botão pedir alteração:', await u.locator('button',{hasText:'Pedir alteração'}).count())
 await clique(u,/Pedir alteração à Unidigit/); console.log('  diálogo de pedido aberto:', await u.locator('textarea').count()>0); await u.keyboard.press('Escape'); await u.waitForTimeout(300)
 await clique(u,/Validar cronograma/); await u.locator('button',{hasText:/Validar/}).last().click(); await u.waitForTimeout(1200)
 // equipe
 const e=await login('admin'); await abrir(e); await dadosTab(e)
 console.log('EQUIPE (validado) início desabilitado:', await ini(e).isDisabled(), '| botão reabrir:', await e.locator('#dados-turma button',{hasText:'Reabrir para alterar'}).count())
 await e.screenshot({path:'/tmp/wpt/r_validado.png'})
 await e.locator('#dados-turma button',{hasText:'Reabrir para alterar'}).click(); await e.waitForTimeout(500)
 await e.locator('textarea').fill('Mudança de calendário'); await e.locator('[role=dialog] button',{hasText:/Reabrir/}).click(); await e.waitForTimeout(1500)
 console.log('EQUIPE (reaberto) início desabilitado:', await ini(e).isDisabled())
 const tabC=async()=>{ await e.getByRole('tab',{name:/^Cronograma/}).click(); await e.waitForTimeout(400) }
 await tabC()
 const antes=await e.locator('input[type=date]').evaluateAll(a=>a.map(x=>x.value).slice(0,4).join(' '))
 await dadosTab(e); await ini(e).fill('2026-10-05'); await e.waitForTimeout(2500); await tabC()
 const depois=await e.locator('input[type=date]').evaluateAll(a=>a.map(x=>x.value).slice(0,4).join(' '))
 console.log('  antes :',antes,'\n  depois:',depois)
 await e.screenshot({path:'/tmp/wpt/r_editado.png'})
 await b.close()})().catch(x=>{console.log('FALHOU',x.message);process.exit(1)})
