const B='http://127.0.0.1:8099'; let fails=0
const ok=(c,m)=>{ console.log((c?'OK   ':'FALHA ')+m); if(!c) fails++ }
class Sess{ constructor(){this.c={}}
  ck(){return Object.entries(this.c).map(([k,v])=>k+'='+v).join('; ')}
  sv(r){ for(const s of r.headers.getSetCookie?.()||[]){ const [kv]=s.split(';'); const i=kv.indexOf('='); const k=kv.slice(0,i), v=kv.slice(i+1); if(/deleted|^$/.test(v)) delete this.c[k]; else this.c[k]=v } }
  async req(path,o={}){ const r=await fetch(B+path,{redirect:'manual',...o,headers:{...(o.headers||{}),Cookie:this.ck()}}); this.sv(r); return r }
  async login(u,p='senha123',redir=''){ this.c={wordpress_test_cookie:'WP%20Cookie%20check'}; const r=await this.req('/wp-login.php',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({log:u,pwd:p,'wp-submit':'Log In',redirect_to:redir,testcookie:'1'})}); return r }
  async nonce(pid){ let r=await this.req('/?page_id='+pid); if([301,302,303,307,308].includes(r.status)){ const loc=r.headers.get('location'); if(loc){ const u=new URL(loc,B); r=await this.req(u.pathname+u.search) } } const t=await r.text(); const m=t.match(/CRONOGRAMA_EAD\s*=\s*(\{.*?\});/s); return m?JSON.parse(m[1]).nonce:null }
  async api(method,path,body,n){ const r=await this.req('/?rest_route=/cronograma-ead/v1/'+path,{method,headers:{'Content-Type':'application/json','X-WP-Nonce':n},body:body===undefined?undefined:JSON.stringify(body)}); let j=null; try{j=await r.json()}catch{} return {status:r.status,j} } }
const PID=4, run=Date.now()
const adm=new Sess(); await adm.login('admin'); const na=await adm.nonce(PID)
const eq2=new Sess(); await eq2.login('equipe2'); const ne2=await eq2.nonce(PID)
const uni=new Sess(); const rl=await uni.login('coord_itb'); const nu=await uni.nonce(PID)
// 1) listar
let r=await adm.api('GET','acessos',undefined,na); ok(r.status===200&&r.j.usuarios.length>=5,'admin lista acessos ('+r.j?.usuarios?.length+')'); ok(r.j.podeEquipe===true,'admin pode gerir equipe')
ok(r.j.usuarios.find(u=>u.login==='admin')?.protegido===true,'administrador do site aparece como protegido')
r=await uni.api('GET','acessos',undefined,nu); ok(r.status===403,'unidade não acessa a lista de acessos ('+r.status+')')
// 2) criar coordenador
const em=`nova.luz${run}@senai.exemplo`
r=await adm.api('POST','acessos',{nome:'Nova Coordenação Luziânia',email:em,tipo:'coordenador',unidades:['u_luz'],enviarEmail:false},na)
ok(r.status===200&&r.j.usuario.tipo==='coordenador'&&r.j.usuario.unidades[0]==='u_luz','cria coordenador de Luziânia ('+r.status+')'); const novo=r.j?.usuario
ok(!('link' in (r.j||{})),'criação não devolve token ou link de senha')
r=await adm.api('POST','acessos',{nome:'Dup',email:em,tipo:'auxiliar',unidades:['u_luz']},na); ok(r.status===409,'e-mail repetido → 409')
r=await adm.api('POST','acessos',{nome:'Sem unidade',email:`x${run}@s.exemplo`,tipo:'auxiliar',unidades:[]},na); ok(r.status===400,'unidade obrigatória → 400')
r=await adm.api('POST','acessos',{nome:'Fantasma',email:`y${run}@s.exemplo`,tipo:'auxiliar',unidades:['u_inexistente']},na); ok(r.status===400,'unidade inexistente → 400')
r=await adm.api('POST','acessos',{nome:'Mau',email:'nao-e-email',tipo:'consulta',unidades:['u_luz']},na); ok(r.status===400,'e-mail inválido → 400')
// 3) segurança do link: só envio por e-mail, nunca exposição ao operador
r=await adm.api('POST',`acessos/${novo.id}/link`,{},na); ok((r.status===200||r.status===502)&&!('link' in (r.j||{})),'novo acesso não expõe link/token ('+r.status+')')
// 4) equipe sem edit_users
r=await eq2.api('POST','acessos',{nome:'Outro da equipe',email:`eq${run}@s.exemplo`,tipo:'equipe'},ne2); ok(r.status===403,'membro da equipe não cria outro membro da equipe ('+r.status+')')
r=await eq2.api('POST','acessos',{nome:'Aux Itb',email:`aux${run}@s.exemplo`,tipo:'auxiliar',unidades:['u_itb']},ne2); ok(r.status===200,'mas cria auxiliar de unidade'); const aux=r.j?.usuario
r=await eq2.api('POST',`acessos/${(await adm.api('GET','acessos',undefined,na)).j.usuarios.find(u=>u.login==='equipe2').id}`,{tipo:'consulta',unidades:['u_itb']},ne2); ok(r.status===403,'nem rebaixa um colega de equipe ('+r.status+')')
// 5) editar
r=await adm.api('POST',`acessos/${aux.id}`,{tipo:'coordenador',unidades:['u_itb','u_luz']},na); ok(r.status===200&&r.j.usuario.tipo==='coordenador'&&r.j.usuario.unidades.length===2,'promove auxiliar a coordenador, 2 unidades')
r=await adm.api('POST',`acessos/${aux.id}`,{tipo:'equipe'},na); ok(r.status===200&&r.j.usuario.tipo==='equipe'&&r.j.usuario.unidades.length===0,'admin pode torná-lo equipe')
const adminId=(await adm.api('GET','acessos',undefined,na)).j.usuarios.find(u=>u.login==='admin').id
r=await adm.api('POST',`acessos/${adminId}`,{ativo:false},na); ok(r.status===403,'administrador do site não é alterado por aqui')
// 6) desativar / reativar e impedir geração de acesso enquanto inativo
r=await adm.api('POST',`acessos/${novo.id}`,{ativo:false},na); ok(r.status===200&&r.j.usuario.ativo===false,'desativa o novo coordenador')
r=await adm.api('POST',`acessos/${novo.id}/link`,{},na); ok(r.status===409,'não gera link para quem está desativado')
r=await adm.api('POST',`acessos/${novo.id}`,{ativo:true},na); ok(r.j.usuario.ativo===true,'reativa')
r=await adm.api('POST',`acessos/${novo.id}/link`,{},na); ok((r.status===200||r.status===502)&&!('link' in (r.j||{})),'envio de novo acesso não expõe segredo')
// 7) login com a marca
const lp=await (await fetch(B+'/wp-login.php')).text(); ok(/Unidigit@l/.test(lp)&&/Sistema de cronogramas EaD/.test(lp),'tela de entrada com a marca Unidigit@l')
// 8) admin cai no painel, equipe vai ao sistema
const la=await new Sess().login('admin','senha123',B+'/wp-admin/'); ok(/wp-admin/.test(la.headers.get('location')||''),'administrador que pede o painel continua indo ao painel')
const le=await new Sess().login('equipe2','senha123',B+'/wp-admin/'); ok(/page_id=\d+|cronograma/.test(le.headers.get('location')||''),'equipe vai ao Cronograma ('+le.headers.get('location')+')')
console.log(fails?`\n${fails} FALHA(S)`:'\nTUDO OK')
