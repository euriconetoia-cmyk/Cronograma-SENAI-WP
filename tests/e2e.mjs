const B='http://127.0.0.1:8099'; let fails=0
const ok=(c,m)=>{ console.log((c?'OK   ':'FALHA ')+m); if(!c) fails++ }
class Sess{ constructor(){this.c={}}
  ck(){return Object.entries(this.c).map(([k,v])=>k+'='+v).join('; ')}
  sv(r){ for(const s of r.headers.getSetCookie?.()||[]){ const [kv]=s.split(';'); const i=kv.indexOf('='); this.c[kv.slice(0,i)]=kv.slice(i+1) } }
  async req(path,o={}){ const r=await fetch(B+path,{redirect:'manual',...o,headers:{...(o.headers||{}),Cookie:this.ck()}}); this.sv(r); return r }
  async login(u){ this.c={wordpress_test_cookie:'WP%20Cookie%20check'}; const r=await this.req('/wp-login.php',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({log:u,pwd:'senha123','wp-submit':'Log In',redirect_to:B+'/wp-admin/',testcookie:'1'})}); return r.status }
  async page(id){ let r=await this.req('/?page_id='+id); if([301,302,303,307,308].includes(r.status)){ const loc=r.headers.get('location'); if(loc){ const u=new URL(loc,B); r=await this.req(u.pathname+u.search) } } const t=await r.text(); const m=t.match(/CRONOGRAMA_EAD\s*=\s*(\{.*?\});/s); return {status:r.status,html:t,cfg:m?JSON.parse(m[1]):null} }
  async api(method,path,body,nonce){ const r=await this.req('/?rest_route=/cronograma-ead/v1/'+path,{method,headers:{'Content-Type':'application/json','X-WP-Nonce':nonce},body:body===undefined?undefined:JSON.stringify(body)}); let j=null; try{j=await r.json()}catch{} return {status:r.status,j} } }
const ids=JSON.parse(process.argv[2]); const pid=ids.cronograma
// anônimo
{ const s=new Sess(); const h=await s.req('/'); ok(h.status===200,'home anônima 200 (status '+h.status+')'); const p=await s.page(pid); ok(p.status===200 && /ce-login-gateway/.test(p.html) && !p.cfg,'página do cronograma pede login') }
const U={}
for(const u of ['admin','coord_itb','aux_itb','coord_luz','consulta']){ const s=new Sess(); const st=await s.login(u); const p=await s.page(pid); ok(p.status===200&&p.cfg,`${u}: login (${st}) e página carrega com config`); U[u]={s,n:p.cfg?.nonce,perfil:p.cfg?.perfil}; }
console.log('perfis:',Object.entries(U).map(([k,v])=>k+'='+v.perfil).join(' '))
ok(U.admin.perfil==='equipe','admin = equipe'); ok(U.coord_itb.perfil==='unidade','coord_itb = unidade'); ok(U.consulta.perfil==='consulta','consulta = consulta')
const boot=async u=>(await U[u].s.api('GET','bootstrap',undefined,U[u].n))
let b=await boot('admin'); ok(b.status===200,'bootstrap admin 200'); const turmas=b.j?.turmas||[]; console.log('turmas admin:',turmas.map(t=>t.id+':'+t.status).join(', '))
const bi=await boot('coord_itb'); ok((bi.j.turmas||[]).every(t=>t.unidadeId==='u_itb'),'coord_itb só vê Itumbiara ('+(bi.j.turmas||[]).length+')')
const bl=await boot('coord_luz'); ok(!(bl.j.turmas||[]).some(t=>t.id==='t_tst_itb'),'coord_luz não vê turma de Itumbiara')
const r404=await U.coord_luz.s.api('GET','turmas/t_tst_itb/historico',undefined,U.coord_luz.n); ok(r404.status===404||r404.status===403,'coord_luz bloqueado no histórico de outra unidade ('+r404.status+')')
const cons=await U.consulta.s.api('POST','turmas',{turma:{id:'x',cursoId:'c',unidadeId:'u_itb',nome:'x'}},U.consulta.n); ok(cons.status===403,'consulta não cria turma ('+cons.status+')')
// fluxo
const cursoId=b.j?.catalogo?.cursos?.[0]?.id; ok(!!cursoId, 'catálogo contém curso inicial para testar criação'); if (!cursoId) throw new Error('Pré-condição E2E: catálogo de cursos vazio'); const ID='t_fluxo_'+Date.now()
let cr=await U.admin.s.api('POST','turmas',{turma:{id:ID,cursoId,unidadeId:'u_itb',nome:'Turma Fluxo',inicio:'2026-05-04',obs:'',evento:'',monitorId:'',tutorId:'',coordId:'',profId:'',ambiente:'',itens:{}}},U.admin.n)
ok(cr.status===200||cr.status===201,'admin cria turma ('+cr.status+') status '+cr.j?.status); let t=cr.j
const A=async(u,acao,extra={})=>{ const r=await U[u].s.api('POST',`turmas/${ID}/acao`,{acao,rev:t.rev,...extra},U[u].n); if(r.status===200) t=r.j; return r }
ok((await A('coord_itb','validar')).status>=400,'unidade não valida em solicitado')
ok(t.status==='elaboracao','equipe cria já em elaboração')
t.itens=t.itens||{}; const sv=await U.admin.s.api('POST',`turmas/${ID}`,{turma:{...t,ambiente:'Sala A',inicio:'2026-05-11'},rev:t.rev},U.admin.n); ok(sv.status===200 && sv.j.inicio==='2026-05-11','equipe salva e altera o início ('+sv.status+')'); if(sv.status===200) t=sv.j
ok((await A('admin','enviar')).status===200,'enviar → '+t.status)
ok(t.status==='validacao','status validacao')
const sv2=await U.coord_itb.s.api('POST',`turmas/${ID}`,{turma:{...t,ambiente:'Lab 2',inicio:'2030-01-01',nome:'HACK'},rev:t.rev},U.coord_itb.n); ok(sv2.status===200&&sv2.j.ambiente==='Lab 2'&&sv2.j.inicio==='2026-05-11'&&sv2.j.nome==='Turma Fluxo','unidade ajusta ambiente; início e nome ignorados'); if(sv2.status===200) t=sv2.j
const sv3=await U.aux_itb.s.api('POST',`turmas/${ID}`,{turma:{...t,ambiente:'Lab 3'},rev:t.rev},U.aux_itb.n); ok(sv3.status===200,'auxiliar também ajusta'); if(sv3.status===200) t=sv3.j
ok((await A('aux_itb','validar')).status>=400,'auxiliar (sem "Pode validar") não valida')
ok((await A('coord_itb','validar')).status===200,'coord_itb valida → '+t.status)
const sv4=await U.coord_itb.s.api('POST',`turmas/${ID}`,{turma:{...t,ambiente:'X'},rev:t.rev},U.coord_itb.n); ok(sv4.status>=400,'validado: unidade não edita ('+sv4.status+')')
const sv5=await U.admin.s.api('POST',`turmas/${ID}`,{turma:{...t,ambiente:'X'},rev:t.rev},U.admin.n); ok(sv5.status>=400,'validado: equipe também não edita ('+sv5.status+')')
ok((await A('admin','reabrir')).status>=400,'reabrir exige motivo')
ok((await A('admin','reabrir',{motivo:'Mudança de calendário'})).status===200 && t.status==='validacao' && t.versao===2,'reabrir → validacao v'+t.versao)
const h=await U.coord_itb.s.api('GET',`turmas/${ID}/historico`,undefined,U.coord_itb.n); ok(h.status===200,'unidade lê histórico ('+h.status+')')
const old=await U.admin.s.api('POST',`turmas/${ID}`,{turma:{...t,ambiente:'Y'},rev:t.rev-1},U.admin.n); ok(old.status===409,'conflito de revisão → 409 ('+old.status+')')
const at=await U.coord_itb.s.api('GET','atividade',undefined,U.coord_itb.n); ok(at.status===200&&Array.isArray(at.j.atividade)&&at.j.atividade.length>0&&at.j.atividade.every(x=>x.turmaId===ID || (bi.j.turmas||[]).some(t=>t.id===x.turmaId)),'atividade recente (unidade) ('+at.status+', '+(at.j.atividade||[]).length+' itens)')
const atL=await U.coord_luz.s.api('GET','atividade',undefined,U.coord_luz.n); ok(atL.status===200&&!(atL.j.atividade||[]).some(x=>x.turmaId===ID),'atividade não vaza turmas de outra unidade')
const atA=await U.admin.s.api('GET','atividade',undefined,U.admin.n); ok(atA.status===200&&atA.j.atividade.some(x=>x.turmaId===ID),'equipe vê atividade de todas as turmas')
{ const bt=await U.admin.s.api('GET','bootstrap',undefined,U.admin.n); const cat=bt.j.catalogo; const orig=cat.cursos[0].modalidade; cat.cursos[0].modalidade='semipresencial'; cat.cursos[0].categoria='qualificacao'
  const sv=await U.admin.s.api('POST','catalogo',{data:cat,rev:bt.j.crev},U.admin.n); ok(sv.status===200,'salva catálogo com modalidade ('+sv.status+')')
  const b2=await U.admin.s.api('GET','bootstrap',undefined,U.admin.n); ok(b2.j.catalogo.cursos[0].modalidade==='semipresencial'&&b2.j.catalogo.cursos[0].categoria==='qualificacao','modalidade do curso persistiu')
  const b3=await U.coord_itb.s.api('GET','bootstrap',undefined,U.coord_itb.n); ok(b3.j.catalogo.cursos.every(c=>c.modalidade!==undefined&&c.categoria!==undefined),'unidade também recebe a modalidade') }
const ex=await U.admin.s.api('GET','exportar',undefined,U.admin.n); ok(ex.status===200&&ex.j.turmas.length>=2,'backup exporta')
ok(ex.j?.schemaVersion===4&&ex.j?.backupMode==='full-state'&&typeof ex.j?.checksum==='string','backup usa formato completo v4')
const exu=await U.coord_itb.s.api('GET','exportar',undefined,U.coord_itb.n); ok(exu.status===403,'unidade não exporta backup ('+exu.status+')')

// restauração completa: cria um dado depois do backup, simula e volta exatamente ao estado salvo
const EXTRA='t_pos_backup_'+Date.now()
const extra=await U.admin.s.api('POST','turmas',{turma:{id:EXTRA,cursoId,unidadeId:'u_itb',nome:'Criada depois do backup',inicio:'2026-08-03',obs:'',evento:'',monitorId:'',tutorId:'',coordId:'',profId:'',ambiente:'',itens:{}}},U.admin.n)
ok(extra.status===200||extra.status===201,'cria turma depois do backup ('+extra.status+')')
const beforeRestore=await U.admin.s.api('GET','bootstrap',undefined,U.admin.n)
const sim=await U.admin.s.api('POST','importar',{...ex.j,simular:true},U.admin.n)
if(sim.status!==200) console.log('erro simulação backup:',JSON.stringify(sim.j))
ok(sim.status===200&&sim.j?.simulacao===true&&typeof sim.j?.confirmacao==='string','simula restauração completa ('+sim.status+')')
const restored=await U.admin.s.api('POST','importar',{...ex.j,rev:beforeRestore.j.crev,confirmacao:sim.j.confirmacao,simular:false},U.admin.n)
ok(restored.status===200,'restauração completa executa ('+restored.status+')')
const afterRestore=await U.admin.s.api('GET','bootstrap',undefined,U.admin.n)
ok(!(afterRestore.j?.turmas||[]).some(x=>x.id===EXTRA),'restauração remove turma criada após o backup')
const restoredFlow=(afterRestore.j?.turmas||[]).find(x=>x.id===ID)
const backedFlow=(ex.j?.turmas||[]).find(x=>x.id===ID)
ok(!!restoredFlow&&!!backedFlow&&restoredFlow.status===backedFlow.status&&restoredFlow.versao===backedFlow.versao,'restauração preserva status e versão da turma')
console.log(fails?`\n${fails} FALHA(S)`:'\nTUDO OK')
