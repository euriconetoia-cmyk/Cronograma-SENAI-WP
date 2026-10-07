import type { Atividade, AvisosResp, SubtipoPedido, Acesso, AcessoCriado, AcessoNovo, AcessosLista, AcaoNome, Boot, Catalogo, Historico, Turma, VersaoCompleta } from './types'

export class ApiError extends Error {
  status: number; code: string; turma?: Turma | null
  constructor(status: number, code: string, message: string, turma?: Turma | null) { super(message); this.status = status; this.code = code.replace('cronograma_ead_', ''); this.turma = turma }
}

export interface AcaoBody { acao: AcaoNome; rev: number; motivo?: string; ressalva?: string; prazo?: string; tipo?: SubtipoPedido; atende?: boolean }
export interface Copia { format?: string; formato?: string; schemaVersion?: number; applicationVersion?: string; generatedAt?: string; siteId?: string; checksum?: string; catalogo: Catalogo; turmas: Turma[] }

export interface Api {
  mock?: boolean
  boot(): Promise<Boot>
  saveCatalogo(data: Catalogo, rev: number): Promise<{ rev: number }>
  criar(turma: Partial<Turma> & { id: string }): Promise<Turma>
  salvar(id: string, turma: Turma, rev: number, motivo?: string): Promise<Turma>
  acao(id: string, body: AcaoBody): Promise<Turma>
  excluir(id: string): Promise<void>
  historico(id: string): Promise<Historico>
  versao(id: string, n: number): Promise<VersaoCompleta>
  atividade(): Promise<{ atividade: Atividade[] }>
  avisos(): Promise<AvisosResp>
  avisosLidos(b: { ids?: number[]; turma?: string; todos?: boolean }): Promise<{ ok: boolean }>
  atenderPedido(id: number): Promise<AvisosResp>
  emailTeste(): Promise<{ ok: boolean; para: string }>
  acessos(): Promise<AcessosLista>
  criarAcesso(b: AcessoNovo): Promise<AcessoCriado>
  salvarAcesso(id: number, b: Partial<AcessoNovo> & { ativo?: boolean }): Promise<{ usuario: Acesso }>
  linkAcesso(id: number): Promise<{ emailEnviado: boolean }>
  exportar(): Promise<Copia>
  simularImportacao(copia: Copia): Promise<{ simulacao: boolean; criadas: number; atualizadas: number; ignoradas: number; schemaVersion: number; confirmacao: string }>
  importar(copia: Copia, rev: number, confirmacao: string): Promise<{ rev: number; turmas: number; puladas: number; criadas?: number; atualizadas?: number; ignoradas?: number }>
}

interface Config { rest: string; nonce: string; pages: Record<string, string>; perfil: string; view: string; turma: string; logout: string }
export const config = (): Config | null => (window as unknown as { CRONOGRAMA_EAD?: Config }).CRONOGRAMA_EAD ?? null

export function realApi(c: Config): Api {
  async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    let r: Response
    try {
      r = await fetch(c.rest + path, { method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': c.nonce }, body: body === undefined ? undefined : JSON.stringify(body) })
      window.dispatchEvent(new CustomEvent('cronograma:network', { detail: { online: true } }))
    } catch {
      window.dispatchEvent(new CustomEvent('cronograma:network', { detail: { online: false } }))
      throw new ApiError(0, 'rede', 'Sem conexão com o servidor. Confira a internet e tente de novo.')
    }
    let j: unknown = null
    try { j = await r.json() } catch { /* corpo vazio */ }
    if (!r.ok) {
      const e = (j || {}) as { code?: string; message?: string; data?: { turma?: Turma } }
      const expired = r.status === 401 || (r.status === 403 && e.code === 'rest_cookie_invalid_nonce')
      if (expired) window.dispatchEvent(new CustomEvent('cronograma:session-expired'))
      const msg = expired ? 'Sua sessão expirou. Recarregue a página e entre de novo.' : e.message || `Erro ${r.status}`
      throw new ApiError(r.status, e.code || 'erro', msg, e.data?.turma)
    }
    return j as T
  }
  return {
    boot: () => call('GET', 'bootstrap'),
    saveCatalogo: (data, rev) => call('POST', 'catalogo', { data, rev }),
    criar: turma => call('POST', 'turmas', { turma }),
    salvar: (id, turma, rev, motivo) => call('POST', `turmas/${id}`, { turma, rev, motivo }),
    acao: (id, body) => call('POST', `turmas/${id}/acao`, body),
    excluir: async id => { await call('POST', `turmas/${id}/excluir`, {}) },
    historico: id => call('GET', `turmas/${id}/historico`),
    versao: (id, n) => call('GET', `turmas/${id}/versoes/${n}`),
    atividade: () => call('GET', 'atividade'),
    avisos: () => call('GET', 'avisos'),
    avisosLidos: b => call('POST', 'avisos/lidos', b),
    atenderPedido: id => call('POST', `avisos/${id}/atender`, {}),
    emailTeste: () => call('POST', 'email-teste', {}),
    acessos: () => call('GET', 'acessos'),
    criarAcesso: b => call('POST', 'acessos', b),
    salvarAcesso: (id, b) => call('POST', `acessos/${id}`, b),
    linkAcesso: id => call('POST', `acessos/${id}/link`, {}),
    exportar: () => call('GET', 'exportar'),
    simularImportacao: copia => call('POST', 'importar', { ...copia, simular: true }),
    importar: (copia, rev, confirmacao) => call('POST', 'importar', { ...copia, rev, confirmacao, simular: false }),
  }
}
