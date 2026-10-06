const { chromium } = require('/opt/node22/lib/node_modules/playwright')
;(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'})
 const login=async(u)=>{ const ctx=await b.newContext({viewport:{width:1400,height:1000}}); const p=await ctx.newPage(); p.on('pageerror',e=>{ if(!/wp is not|moment|jQuery/.test(e.message)) console.log('  JS ERRO',e.message)}); await p.goto('http://127.0.0.1:8099/wp-login.php'); await p.fill('#user_login',u); await p.fill('#user_pass','senha123'); await Promise.all([p.waitForNavigation(),p.click('#wp-submit')]); return p }
 const p=await login('admin'); await p.goto('http://127.0.0.1:8099/?page_id=4'); await p.waitForSelector('nav[aria-label="Seções"]'); 
 console.log('abas:', (await p.locator('nav[aria-label="Seções"] a').allInnerTexts()).map(s=>s.replace(/\s+\d+$/,'')).join(' | '))
 await p.locator('nav[aria-label="Seções"] a',{hasText:'Configurações'}).click(); await p.waitForSelector('table'); await p.waitForTimeout(500)
 console.log('linhas:', await p.locator('tbody tr').count())
 await p.locator('button',{hasText:'Novo acesso'}).first().click(); await p.waitForTimeout(400)
 const d=p.locator('[role=dialog]'); await d.locator('input').nth(0).fill('Direção SENAI Luziânia'); await d.locator('input[type=email]').fill('direcao.luz'+Date.now()+'@senai.exemplo')
 await d.locator('select').selectOption('auxiliar'); await d.locator('input[type=checkbox]').first().check().catch(()=>{})
 const cbs=await d.locator('fieldset input[type=checkbox]').count(); console.log('unidades no formulário:',cbs); await d.locator('fieldset input[type=checkbox]').nth(1).check()
 await d.locator('button',{hasText:'Criar acesso'}).click(); await p.waitForTimeout(2500)
 const txt=await p.locator('[role=dialog] textarea').inputValue(); console.log('texto pronto:\n'+txt.split('\n').slice(0,4).join('\n')+'\n...')
 await p.screenshot({path:'/tmp/wpt/r_acessos.png'}); await p.locator('[role=dialog] button',{hasText:'Pronto'}).click(); await p.waitForTimeout(500)
 console.log('linhas depois:', await p.locator('tbody tr').count()); await p.screenshot({path:'/tmp/wpt/r_acessos2.png'})
 const u=await login('coord_itb'); await u.goto('http://127.0.0.1:8099/?page_id=4'); await u.waitForSelector('nav[aria-label="Seções"]')
 console.log('abas da unidade:', (await u.locator('nav[aria-label="Seções"] a').allInnerTexts()).map(s=>s.replace(/\s+\d+$/,'')).join(' | '))
 await b.close()})().catch(e=>{console.log('FALHOU',e.message);process.exit(1)})
