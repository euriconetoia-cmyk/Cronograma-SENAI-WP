import seed from './seed.json'
import { ApiError, type Api, type Copia } from './api'
import { checarAcao, diff, mergeUnidade, mudouData, podeEditar } from './rules'
import type { Aviso, AvisosResp, Acesso, AcessoNovo, AcaoNome, Boot, Catalogo, Historico, LogItem, Me, Status, Turma, Vigente, VersaoCompleta } from './types'

/** Servidor de mentira para a prévia: aplica as mesmas regras do plugin, só na memória do navegador. */
export const USUARIOS: Record<string, Me & { rotulo: string }> = {
  equipe: { id: 1, nome: 'Leonardo Dias', perfil: 'equipe', unidades: [], validador: false, prazoDias: 5, rotulo: 'Unidigit@l (equipe)' },
  itb_coord: { id: 2, nome: 'Coordenação SENAI Itumbiara', perfil: 'unidade', unidades: ['u_itb'], validador: true, prazoDias: 5, rotulo: 'Itumbiara · coordenador (valida)' },
  itb_aux: { id: 3, nome: 'Auxiliar SENAI Itumbiara', perfil: 'unidade', unidades: ['u_itb'], validador: false, prazoDias: 5, rotulo: 'Itumbiara · auxiliar (não valida)' },
  luz_coord: { id: 4, nome: 'Coordenação SENAI Luziânia', perfil: 'unidade', unidades: ['u_luz'], validador: true, prazoDias: 5, rotulo: 'Luziânia · coordenador (valida)' },
  consulta: { id: 5, nome: 'Consulta Itumbiara', perfil: 'consulta', unidades: ['u_itb'], validador: false, prazoDias: 5, rotulo: 'Itumbiara · somente consulta' },
}

const ACESSOS: Acesso[] = [
  { id: 1, nome: 'Leonardo Dias', email: 'leonardo@unidigital.exemplo', login: 'leonardo', tipo: 'equipe', unidades: [], ativo: true, ultimoAcesso: '', protegido: true, voce: false },
  { id: 2, nome: 'Coordenação SENAI Itumbiara', email: 'coord.itb@senai.exemplo', login: 'coord.itb', tipo: 'coordenador', unidades: ['u_itb'], ativo: true, ultimoAcesso: '2026-10-02T14:20:00Z', protegido: false, voce: false },
  { id: 3, nome: 'Auxiliar SENAI Itumbiara', email: 'aux.itb@senai.exemplo', login: 'aux.itb', tipo: 'auxiliar', unidades: ['u_itb'], ativo: true, ultimoAcesso: '', protegido: false, voce: false },
  { id: 4, nome: 'Coordenação SENAI Luziânia', email: 'coord.luz@senai.exemplo', login: 'coord.luz', tipo: 'coordenador', unidades: ['u_luz'], ativo: true, ultimoAcesso: '', protegido: false, voce: false },
]
let proxAcesso = 100
const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o))
const S = { ...(clone(seed) as unknown as { cursos: Catalogo['cursos']; pessoas: Catalogo['pessoas']; feriados: Catalogo['feriados']; unidades: Catalogo['unidades']; turmas: Turma[] }), crev: 1 }
const snaps: Record<string, Record<number, VersaoCompleta>> = {}
const logs: Record<string, LogItem[]> = {}
let logId = 1
let atual = 'equipe'
export const trocarUsuario = (k: string) => { atual = k }
export const usuarioAtual = () => atual
const me = () => USUARIOS[atual]
const agora = () => new Date().toISOString().slice(0, 19).replace('T', ' ')
const hoje = () => new Date().toISOString().slice(0, 10)

function somarUteis(d: string, n: number) { const t = new Date(d + 'T12:00:00Z'); while (n > 0) { t.setUTCDate(t.getUTCDate() + 1); const w = t.getUTCDay(); if (w !== 0 && w !== 6) n-- } return t.toISOString().slice(0, 10) }
function log(t: Turma, acao: string, motivo = '', detalhe: LogItem['detalhe'] = null) {
  (logs[t.id] ||= []).unshift({ id: logId++, versao: t.versao, quem: me().nome, perfil: me().perfil, acao, motivo, detalhe, em: agora() })
}
const avisosS: Aviso[] = []
let proxAviso = 1
function aviso(t: Turma, para: 'equipe' | 'unidade', tipo: string, titulo: string, texto = '', subtipo = '', pedido = false) {
  avisosS.unshift({ id: proxAviso++, turmaId: t.id, unidadeId: t.unidadeId, para, tipo, subtipo, titulo, texto, de: me().nome, pedido, emailOk: null, em: agora(), lido: false, atendidoEm: null, atendidoPor: '', meu: false })
}
function atenderTurma(id: string) { avisosS.forEach(a => { if (a.turmaId === id && a.pedido && !a.atendidoEm) { a.atendidoEm = agora(); a.atendidoPor = me().nome; a.lido = true } }) }
const ve = (t: Turma) => me().perfil === 'equipe' || me().unidades.includes(t.unidadeId)
const get = (id: string) => { const t = S.turmas.find(x => x.id === id); if (!t || !ve(t)) throw new ApiError(404, 'nao_achou', 'Turma não encontrada.'); return t }
const vigente = (id: string): Vigente | null => { const v = snaps[id]; if (!v) return null; const n = Math.max(...Object.keys(v).map(Number)); const x = v[n]; return { versao: n, por: x.por, em: x.em, ressalva: x.ressalva } }
const out = (t: Turma): Turma => ({ ...clone(t), vigente: vigente(t.id) })
const MSG: Record<string, string> = { acao_invalida: 'Ação desconhecida.', sem_permissao: 'Seu perfil não pode fazer esta ação.', status_incompativel: 'Esta ação não está disponível no status atual do cronograma.', nao_validador: 'Só quem foi indicado como validador da unidade pode validar.', motivo_obrigatorio: 'Escreva o motivo.' }
const strip = (t: Turma) => { const { status: _s, versao: _v, rev: _r, prazo: _p, vigente: _g, ...resto } = t; void _s; void _v; void _r; void _p; void _g; return resto as unknown as Record<string, unknown> }
const idsCurso = (cid: string) => S.cursos.find(c => c.id === cid)?.modulos.flatMap(m => m.itens.map(i => i.id)) ?? null

// Estado inicial de demonstração: uma solicitação da unidade de Luziânia.
const curso0 = S.cursos[0]
S.turmas.push({ id: 't_luz_sol', cursoId: curso0.id, nome: 'TST Luziânia 2026/2', unidadeId: 'u_luz', inicio: '2026-11-07', evento: '', monitorId: '', tutorId: '', coordId: '', profId: '', ambiente: '', obs: 'Preciso da turma para o segundo semestre.', itens: {}, status: 'solicitado', versao: 1, rev: 1, prazo: '', vigente: null })

// Mais turmas de demonstração, para a página Início ter o que mostrar.
const demo = (id: string, nome: string, un: string, inicio: string, status: Status, extra: Partial<Turma> = {}) => S.turmas.push({ ...clone(S.turmas[0]), id, nome, unidadeId: un, inicio, status, versao: 1, rev: 1, prazo: '', vigente: null, ...extra })
const dia = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10)
demo('t_inf_itb', 'INF 2026', 'u_itb', dia(40), 'validacao', { prazo: dia(-3) })
demo('t_adm_luz', 'ADM 2026', 'u_luz', dia(18), 'validacao', { prazo: dia(2) })
demo('t_log_luz', 'LOG 2026', 'u_luz', dia(-60), 'validado')
demo('t_ele_itb', 'ELE 2025', 'u_itb', dia(-200), 'validado', { versao: 2 })
demo('t_mec_itb', 'MEC 2025', 'u_itb', dia(-300), 'arquivado')
demo('t_tst_itb2', 'TST 2027', 'u_itb', dia(12), 'elaboracao', { versao: 2 })
for (const [id, q, a, m, ago] of [['t_inf_itb', 'Leonardo Dias', 'enviar', '', 4], ['t_log_luz', 'Coordenação SENAI Luziânia', 'validar', '', 1], ['t_tst_itb2', 'Leonardo Dias', 'reabrir', 'Correção de feriado', 2], ['t_adm_luz', 'Leonardo Dias', 'enviar', '', 0]] as const) {
  const t = S.turmas.find(x => x.id === id)!
  ;(logs[id] ||= []).unshift({ id: logId++, versao: t.versao, quem: q, perfil: 'equipe', acao: a, motivo: m, detalhe: null, em: new Date(Date.now() - ago * 864e5 - 3600e3).toISOString().slice(0, 19).replace('T', ' ') })
}

export const mockApi: Api = {
  mock: true,
  async boot() {
    const p = me().perfil
    const turmas = S.turmas.filter(ve).map(out)
    const cat: Catalogo = clone({ cursos: S.cursos, pessoas: S.pessoas, feriados: S.feriados, unidades: S.unidades })
    if (p !== 'equipe') {
      const usados = new Set(turmas.map(t => t.cursoId))
      cat.cursos = cat.cursos.map(c => (usados.has(c.id) ? c : { ...c, modulos: [], resumo: true }))
      cat.feriados = cat.feriados.filter(f => !f[2] || me().unidades.includes(f[2]))
      cat.unidades = cat.unidades.filter(u => me().unidades.includes(u.id))
    }
    const { rotulo: _r, ...m } = me(); void _r
    return { me: m, catalogo: cat, crev: S.crev, turmas } satisfies Boot
  },
  async feriadosNacionais(ano) {
    const fixos: [string, string][] = [
      [`${ano}-01-01`, 'Confraternização Universal'],
      [`${ano}-04-21`, 'Tiradentes'],
      [`${ano}-05-01`, 'Dia Mundial do Trabalho'],
      [`${ano}-09-07`, 'Independência do Brasil'],
      [`${ano}-10-12`, 'Nossa Senhora Aparecida'],
      [`${ano}-11-02`, 'Finados'],
      [`${ano}-11-15`, 'Proclamação da República'],
      [`${ano}-11-20`, 'Dia Nacional de Zumbi e da Consciência Negra'],
      [`${ano}-12-25`, 'Natal'],
    ]
    return { ano, feriados: fixos, cache: true }
  },
  async saveCatalogo(data, rev) {
    if (me().perfil !== 'equipe') throw new ApiError(403, 'sem_permissao', 'Seu perfil não pode alterar o cadastro.')
    if (rev !== S.crev) throw new ApiError(409, 'conflito', 'Os dados foram alterados por outra pessoa.')
    for (const t of S.turmas) {
      if (!data.cursos.some(c => c.id === t.cursoId)) throw new ApiError(422, 'em_uso', 'Há turmas usando um curso que foi removido. Exclua ou arquive as turmas antes.')
      if (!data.unidades.some(u => u.id === t.unidadeId)) throw new ApiError(422, 'em_uso', 'Há turmas ligadas a uma unidade que foi removida.')
    }
    S.cursos = clone(data.cursos); S.pessoas = clone(data.pessoas); S.feriados = clone(data.feriados); S.unidades = clone(data.unidades)
    return { rev: ++S.crev }
  },
  async criar(t) {
    const p = me().perfil
    if (p === 'consulta') throw new ApiError(403, 'sem_permissao', 'Seu perfil não pode criar turmas.')
    if (!(p === 'unidade' && t.cursoSolicitado?.trim()) && (!t.cursoId || !S.cursos.some(c => c.id === t.cursoId))) throw new ApiError(422, 'curso', 'Escolha um curso cadastrado.')
    let nova: Turma
    if (p === 'unidade') {
      const u = t.unidadeId || (me().unidades.length === 1 ? me().unidades[0] : '')
      if (!me().unidades.includes(u)) throw new ApiError(403, 'unidade', 'Escolha uma das suas unidades.')
      nova = { id: t.id, cursoId: t.cursoId || '', ...(t.cursoSolicitado?.trim() && !t.cursoId ? { cursoSolicitado: t.cursoSolicitado.trim() } : {}), nome: t.nome || '', unidadeId: u, inicio: t.inicio || '', obs: t.obs || '', evento: '', monitorId: '', tutorId: '', coordId: '', profId: '', ambiente: '', itens: {}, status: 'solicitado', versao: 1, rev: 1, prazo: '', vigente: null }
    } else {
      if (!t.unidadeId) throw new ApiError(422, 'unidade', 'Escolha a unidade da turma.')
      nova = { ...(clone(t) as Turma), status: 'elaboracao', versao: 1, rev: 1, prazo: '', vigente: null, itens: t.itens || {} }
    }
    S.turmas.push(nova); log(nova, p === 'unidade' ? 'solicitar' : 'criar', nova.obs || '')
    if (p === 'unidade') aviso(nova, 'equipe', 'solicitacao', 'Nova solicitação de turma', nova.nome)
    return out(nova)
  },
  async salvar(id, turma, rev, motivo = '') {
    const row = get(id); const p = me().perfil
    if (!podeEditar(row.status, p)) throw new ApiError(403, 'bloqueada', row.status === 'validado' ? 'Este cronograma está validado e travado. Peça à Unidigit@l para reabrir.' : 'Este cronograma não pode ser alterado no status atual.')
    if (rev !== row.rev) throw new ApiError(409, 'conflito', 'Esta turma foi alterada por outra pessoa.', out(row))
    const stored = strip(row)
    let novo: Record<string, unknown>
    if (p === 'unidade') {
      novo = mergeUnidade(stored, strip(turma), idsCurso(row.cursoId))
      const ch = diff(stored, novo)
      if (!ch.length) return out(row)
      if (mudouData(ch) && !motivo.trim()) throw new ApiError(422, 'motivo_obrigatorio', 'Explique em poucas palavras por que a data do encontro mudou.')
      Object.assign(row, novo); row.rev++; log(row, 'ajuste', motivo, ch)
    } else {
      novo = { ...strip(turma), id: row.id }
      if (row.status === 'validacao') { novo.unidadeId = row.unidadeId; novo.cursoId = row.cursoId }
      const ch = diff(stored, novo)
      if (!ch.length) return out(row)
      if (!novo.unidadeId) throw new ApiError(422, 'unidade', 'A turma precisa de uma unidade.')
      Object.assign(row, clone(novo)); row.rev++
      if (row.status === 'validacao') log(row, 'edicao_equipe', motivo, ch)
    }
    return out(row)
  },
  async acao(id, b) {
    const row = get(id); const p = me().perfil
    const motivo = (b.motivo || '').trim()
    const chk = checarAcao(b.acao, row.status, p, me().validador, motivo)
    if (chk !== true) throw new ApiError(chk === 'motivo_obrigatorio' ? 422 : 403, chk, MSG[chk] || 'Ação não permitida.')
    if (b.rev !== row.rev) throw new ApiError(409, 'conflito', 'Esta turma foi alterada por outra pessoa. Confira e tente de novo.', out(row))
    if (b.acao === 'comentar') {
      const sub = b.tipo === 'reabertura' && row.status !== 'validado' ? 'alteracao' : b.tipo || 'alteracao'
      const rot: Record<string, string> = { alteracao: 'Pedido de alteração', reabertura: 'Pedido de reabertura', duvida: 'Dúvida' }
      if (p === 'unidade') { log(row, 'comentario', `${rot[sub]}: ${motivo}`); aviso(row, 'equipe', 'pedido', `${rot[sub]} · ${row.nome}`, motivo, sub, true) }
      else { log(row, 'comentario', motivo); aviso(row, 'unidade', 'mensagem', `Mensagem da Unidigit@l · ${row.nome}`, motivo); if (b.atende) atenderTurma(row.id) }
      return out(row)
    }
    const para: Record<string, Status> = { iniciar: 'elaboracao', enviar: 'validacao', recolher: 'elaboracao', validar: 'validado', reabrir: 'validacao', arquivar: 'arquivado', restaurar: 'elaboracao' }
    if (b.acao === 'iniciar' && !S.cursos.some(c => c.id === row.cursoId)) throw new ApiError(422, 'curso_pendente', 'Cadastre o curso solicitado e vincule à turma antes de iniciar.')
    if (b.acao === 'enviar') row.prazo = /^\d{4}-\d{2}-\d{2}$/.test(b.prazo || '') ? b.prazo! : somarUteis(hoje(), me().prazoDias)
    if (b.acao === 'validar') {
      const curso = clone(S.cursos.find(c => c.id === row.cursoId)!)
      const feriados = clone(S.feriados.filter(f => !f[2] || f[2] === row.unidadeId))
      const unidade = S.unidades.find(u => u.id === row.unidadeId) || null
      ;(snaps[row.id] ||= {})[row.versao] = { versao: row.versao, por: me().nome + (p === 'equipe' ? ' (em nome da unidade)' : ''), em: agora(), ressalva: (b.ressalva || '').trim(), snapshot: { turma: strip(row) as never, curso, feriados, unidade, versao: row.versao } }
      row.prazo = ''
    }
    if (b.acao === 'reabrir') { row.versao++; row.prazo = somarUteis(hoje(), me().prazoDias) }
    if (b.acao === 'recolher' || b.acao === 'arquivar') row.prazo = ''
    row.status = para[b.acao]; row.rev++
    const av: Record<string, ['equipe' | 'unidade', string, string]> = {
      enviar: ['unidade', 'Cronograma para validar', 'Está pronto para a sua validação.'], recolher: ['unidade', 'Cronograma recolhido', `Motivo: ${motivo}`], validar: ['equipe', 'Cronograma validado', `Versão ${row.versao}.`],
      reabrir: ['unidade', 'Cronograma reaberto', `Voltou para a sua validação (versão ${row.versao}). Motivo: ${motivo}`], iniciar: ['unidade', 'Solicitação aceita', 'A Unidigit@l começou a montar o cronograma.'],
    }
    if (av[b.acao]) aviso(row, av[b.acao][0], b.acao, `${av[b.acao][1]} · ${row.nome}`, av[b.acao][2])
    if (b.acao === 'reabrir') atenderTurma(row.id)
    log(row, b.acao, b.acao === 'validar' && b.ressalva ? `${motivo} Ressalva: ${b.ressalva}`.trim() : motivo)
    return out(row)
  },
  async excluir(id) {
    if (me().perfil !== 'equipe') throw new ApiError(403, 'sem_permissao', 'Seu perfil não pode excluir turmas.')
    const row = get(id)
    if (!['solicitado', 'elaboracao', 'arquivado'].includes(row.status) || snaps[id]) throw new ApiError(409, 'nao_exclui', 'Turmas enviadas à unidade ou já validadas não podem ser excluídas. Arquive a turma.')
    S.turmas = S.turmas.filter(t => t.id !== id)
  },
  async historico(id): Promise<Historico> {
    get(id)
    return { log: clone(logs[id] || []), versoes: Object.values(snaps[id] || {}).sort((a, b) => b.versao - a.versao).map(({ snapshot: _s, ...v }) => { void _s; return v }) }
  },
  async atividade() {
    const todas = S.turmas.filter(ve).flatMap(t => (logs[t.id] || []).map(l => ({ id: l.id, turmaId: t.id, versao: l.versao, quem: l.quem, acao: l.acao, motivo: l.motivo, em: l.em })))
    return { atividade: todas.sort((a, b) => (a.em < b.em ? 1 : a.em > b.em ? -1 : b.id - a.id)).slice(0, 10) }
  },
  async avisos(): Promise<AvisosResp> {
    const p = me().perfil
    if (p === 'consulta') return { avisos: [], naoLidos: 0, pedidosAbertos: 0 }
    const meus = avisosS.filter(a => (p === 'equipe' ? true : me().unidades.includes(a.unidadeId) && (a.para === 'unidade' || a.pedido))).map(a => ({ ...a, meu: a.para === p }))
    return clone({ avisos: meus.slice(0, 80), naoLidos: meus.filter(a => a.meu && !a.lido).length, pedidosAbertos: meus.filter(a => a.pedido && !a.atendidoEm).length })
  },
  async avisosLidos(b: { ids?: number[]; turma?: string; todos?: boolean }) {
    const p = me().perfil
    avisosS.forEach(a => { if (a.para === p && (p === 'equipe' || me().unidades.includes(a.unidadeId)) && (b.todos || b.ids?.includes(a.id) || (b.turma && a.turmaId === b.turma))) a.lido = true })
    return { ok: true }
  },
  async atenderPedido(id: number) {
    if (me().perfil !== 'equipe') throw new ApiError(403, 'sem_permissao', 'Só a Unidigit@l marca pedidos como atendidos.')
    const a = avisosS.find(x => x.id === id); if (a) { a.atendidoEm = agora(); a.atendidoPor = me().nome; a.lido = true }
    return this.avisos()
  },
  async emailTeste() { return { ok: true, para: 'previa@exemplo.com' } },
  async versao(id, n) { get(id); const v = snaps[id]?.[n]; if (!v) throw new ApiError(404, 'nao_achou', 'Versão não encontrada.'); return clone(v) },
  async acessos() {
    if (me().perfil !== 'equipe') throw new ApiError(403, 'sem_permissao', 'Só a Unidigit@l gerencia acessos.')
    return { usuarios: clone(ACESSOS).map(a => ({ ...a, voce: a.id === me().id })), podeEquipe: true, loginUrl: 'https://seu-site.exemplo/wp-login.php' }
  },
  async criarAcesso(b: AcessoNovo) {
    if (!b.nome.trim()) throw new ApiError(400, 'sem_nome', 'Informe o nome da pessoa.')
    if (!/^\S+@\S+\.\S+$/.test(b.email)) throw new ApiError(400, 'email_invalido', 'Informe um e-mail válido.')
    if (ACESSOS.some(a => a.email.toLowerCase() === b.email.toLowerCase())) throw new ApiError(409, 'email_existe', 'Já existe um usuário com este e-mail.')
    if (b.tipo !== 'equipe' && !b.unidades.length) throw new ApiError(400, 'sem_unidade', 'Escolha pelo menos uma unidade escolar.')
    const a: Acesso = { id: proxAcesso++, nome: b.nome.trim(), email: b.email.trim(), login: b.email.split('@')[0].toLowerCase(), tipo: b.tipo, unidades: b.tipo === 'equipe' ? [] : b.unidades, ativo: true, ultimoAcesso: '', protegido: false, voce: false }
    ACESSOS.push(a)
    return { usuario: clone(a), emailEnviado: true }
  },
  async salvarAcesso(id: number, b: Partial<AcessoNovo> & { ativo?: boolean }) {
    const a = ACESSOS.find(x => x.id === id)
    if (!a) throw new ApiError(404, 'nao_encontrado', 'Usuário não encontrado.')
    if (a.protegido) throw new ApiError(403, 'protegido', 'Administradores do site são gerenciados em Usuários, no painel do WordPress.')
    if (b.nome !== undefined) a.nome = b.nome
    if (b.email !== undefined) a.email = b.email
    if (b.tipo !== undefined) a.tipo = b.tipo
    if (b.unidades !== undefined) a.unidades = a.tipo === 'equipe' ? [] : b.unidades
    if (b.ativo !== undefined) a.ativo = b.ativo
    return { usuario: clone(a) }
  },
  async linkAcesso(id: number) {
    const a = ACESSOS.find(x => x.id === id)
    if (!a) throw new ApiError(404, 'nao_encontrado', 'Usuário não encontrado.')
    return { emailEnviado: true }
  },
  async exportar(): Promise<Copia> { return { format: 'cronogramas-ead', schemaVersion: 3, catalogo: clone({ cursos: S.cursos, pessoas: S.pessoas, feriados: S.feriados, unidades: S.unidades }), turmas: clone(S.turmas.map(out)) } },
  async simularImportacao(c) {
    let criadas = 0, atualizadas = 0, ignoradas = 0
    for (const t of c.turmas) { const ex = S.turmas.find(x => x.id === t.id); if (!ex) criadas++; else if (['elaboracao','solicitado'].includes(ex.status)) atualizadas++; else ignoradas++ }
    return { simulacao: true, criadas, atualizadas, ignoradas, schemaVersion: c.schemaVersion ?? 3, confirmacao: 'mock-confirmacao' }
  },
  async importar(c, rev, _confirmacao) {
    await mockApi.saveCatalogo(c.catalogo, rev)
    let n = 0, p = 0
    for (const t of c.turmas) {
      const ex = S.turmas.find(x => x.id === t.id)
      if (!ex) { S.turmas.push({ ...clone(t), status: 'elaboracao', versao: 1, rev: 1, prazo: '', vigente: null }); n++ }
      else if (['elaboracao', 'solicitado'].includes(ex.status)) { Object.assign(ex, { ...clone(t), status: ex.status, versao: ex.versao, rev: ex.rev + 1, prazo: ex.prazo, vigente: null }); n++ } else p++
    }
    return { rev: S.crev, turmas: n, puladas: p }
  },
}
export type { AcaoNome }
