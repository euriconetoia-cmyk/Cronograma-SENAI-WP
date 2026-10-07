const B='http://127.0.0.1:8099'; let fails=0
const ok=(c,m)=>{ console.log((c?'OK   ':'FALHA ')+m); if(!c) fails++ }
class Sess{ constructor(){this.c={}}
  ck(){return Object.entries(this.c).map(([k,v])=>k+'='+v).join('; ')}
  sv(r){ for(const s of r.headers.getSetCookie?.()||[]){ const [kv]=s.split(';'); const i=kv.indexOf('='); this.c[kv.slice(0,i)]=kv.slice(i+1) } }
  async req(path,o={}){ const r=await fetch(B+path,{redirect:'manual',...o,headers:{...(o.headers||{}),Cookie:this.ck()}}); this.sv(r); return r }
  async login(u){ this.c={wordpress_test_cookie:'WP%20Cookie%20check'}; const r=await this.req('/wp-login.php',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({log:u,pwd:'senha123','wp-submit':'Log In',redirect_to:B+'/wp-admin/',testcookie:'1'})}); return r.status }
  async page(id){ const r=await this.req('/?page_id='+id); const t=await r.text(); const m=t.match(/CRONOGRAMA_EAD\s*=\s*(\{.*?\});/s); return {status:r.status,html:t,cfg:m?JSON.parse(m[1]):null} }
  async api(method,path,body,nonce){ const r=await this.req('/?rest_route=/cronograma-ead/v1/'+path,{method,headers:{'Content-Type':'application/json','X-WP-Nonce':nonce},body:body===undefined?undefined:JSON.stringify(body)}); let j=null; try{j=await r.json()}catch{} return {status:r.status,j} } }

const pid=13; const U={}
for(const u of ['admin','coord_itb','aux_itb','coord_luz','consulta']){ const s=new Sess(); await s.login(u); const p=await s.page(pid); U[u]={s,n:p.cfg.nonce,perfil:p.cfg.perfil} }
const api=(u,m,p,b)=>U[u].s.api(m,p,b,U[u].n)
const b=await api('admin','GET','bootstrap'); const cursoId=b.j.turmas[0].cursoId
const ID='t_av_'+Date.now()
let cr=await api('admin','POST','turmas',{turma:{id:ID,cursoId,unidadeId:'u_itb',nome:'Turma Avisos',inicio:'2026-05-04',obs:'',evento:'',monitorId:'',tutorId:'',coordId:'',profId:'',ambiente:'',itens:{}}}); let t=cr.j
ok(cr.status===200||cr.status===201,'cria turma')
const A=async(u,acao,extra={})=>{ const r=await api(u,'POST',`turmas/${ID}/acao`,{acao,rev:t.rev,...extra}); if(r.status===200) t=r.j; return r }
const av=async u=>(await api(u,'GET','avisos')).j
const a0=await av('admin'); const n0=a0.naoLidos
await A('admin','enviar')
let u1=await av('coord_itb'); ok(u1.naoLidos>=1 && u1.avisos.some(a=>a.turmaId===ID&&a.tipo==='enviar'&&a.para==='unidade'),'unidade recebe aviso "para validar" ('+u1.naoLidos+')')
let c0=await av('coord_luz'); ok(!c0.avisos.some(a=>a.turmaId===ID),'outra unidade NÃO vê avisos desta turma')
ok((await av('consulta')).avisos.length===0,'consulta sem avisos')
await A('coord_itb','validar')
let e1=await av('admin'); ok(e1.avisos.some(a=>a.turmaId===ID&&a.tipo==='validar'&&a.para==='equipe'),'equipe recebe aviso de validação')
// pedido de reabertura pela unidade
let r=await A('coord_itb','comentar',{motivo:'Trocar o professor da UC 3',tipo:'reabertura'}); ok(r.status===200,'unidade envia pedido de reabertura ('+r.status+')')
e1=await av('admin'); const ped=e1.avisos.find(a=>a.turmaId===ID&&a.pedido); ok(ped&&!ped.atendidoEm&&ped.subtipo==='reabertura'&&e1.pedidosAbertos>=1,'equipe vê pedido ABERTO (abertos='+e1.pedidosAbertos+')')
ok(e1.naoLidos>n0,'contador de não lidos da equipe subiu')
let u2=await av('coord_itb'); ok(u2.avisos.some(a=>a.pedido&&a.turmaId===ID&&!a.atendidoEm&&!a.meu),'unidade acompanha o próprio pedido (aberto)')
let x=await api('coord_itb','POST',`avisos/${ped.id}/atender`,{}); ok(x.status===403,'unidade não marca como atendido ('+x.status+')')
ok((await api('aux_itb','POST',`avisos/${ped.id}/atender`,{})).status===403,'auxiliar também não')
// pedido de reabertura só em validado: em outro status vira alteração (testado depois)
// equipe reabre -> atende automaticamente
r=await A('admin','reabrir',{motivo:'Atendendo pedido'}); ok(r.status===200&&t.status==='validacao','equipe reabre')
e1=await av('admin'); ok(e1.avisos.find(a=>a.id===ped.id).atendidoEm,'pedido marcado como ATENDIDO ao reabrir')
u2=await av('coord_itb'); ok(u2.avisos.some(a=>a.turmaId===ID&&a.tipo==='reabrir'&&a.para==='unidade'&&!a.lido),'unidade recebe aviso "reaberto"')
// unidade pede alteração em validacao (tipo reabertura é rebaixado)
r=await A('coord_itb','comentar',{motivo:'Carga horária errada',tipo:'reabertura'}); e1=await av('admin'); const p2=e1.avisos.find(a=>a.turmaId===ID&&a.pedido&&!a.atendidoEm); ok(p2&&p2.subtipo==='alteracao','tipo reabertura fora de "validado" vira alteração')
// equipe responde e atende
r=await A('admin','comentar',{motivo:'Ajustado, pode conferir.',atende:true}); ok(r.status===200,'equipe responde'); e1=await av('admin'); ok(e1.avisos.find(a=>a.id===p2.id).atendidoEm,'resposta com "atende" fecha o pedido')
u2=await av('coord_itb'); const msg=u2.avisos.find(a=>a.turmaId===ID&&a.tipo==='mensagem'); ok(msg&&!msg.lido,'unidade recebe a mensagem como NÃO lida')
const nl=u2.naoLidos
// marcar lido: outra unidade não pode marcar
await api('coord_luz','POST','avisos/lidos',{ids:[msg.id]}); u2=await av('coord_itb'); ok(u2.avisos.find(a=>a.id===msg.id).lido===false,'outra unidade não marca lido o meu aviso')
await api('coord_itb','POST','avisos/lidos',{ids:[msg.id]}); u2=await av('coord_itb'); ok(u2.avisos.find(a=>a.id===msg.id).lido===true && u2.naoLidos===nl-1,'unidade marca como lido (contador -1)')
await api('coord_itb','POST','avisos/lidos',{todos:true}); u2=await av('coord_itb'); ok(u2.naoLidos===0,'marcar todos como lidos → 0')
// equipe não "lê" avisos da unidade
const antes=(await av('admin')).naoLidos; await api('coord_itb','POST','avisos/lidos',{todos:true}); ok((await av('admin')).naoLidos===antes,'unidade não limpa o sino da equipe')
// histórico traz o pedido e atendimento
const h=await api('admin','GET',`turmas/${ID}/historico`); ok(h.j.log.some(l=>l.acao==='comentario'&&/Pedido de reabertura/.test(l.motivo)),'histórico registra "Pedido de reabertura"')
// e-mail de teste
const et=await api('admin','POST','email-teste',{}); ok(et.status===200&&('ok' in et.j),'e-mail de teste responde ('+JSON.stringify(et.j)+')'); ok((await api('coord_itb','POST','email-teste',{})).status===403,'unidade não usa e-mail de teste')
// email_falhou registrado?
console.log('log:',h.j.log.map(l=>l.acao).join(','))
console.log(fails?('\nFALHAS: '+fails):'\nTUDO OK')
