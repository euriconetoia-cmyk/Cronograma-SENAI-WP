export type Tipo = 'intro' | 'uc' | 'rec' | 'mat' | 'pratica'
export type Papel = 'monitor' | 'tutor' | 'professor' | 'coordenador'
export type Status = 'solicitado' | 'elaboracao' | 'validacao' | 'validado' | 'arquivado'
export type Perfil = 'equipe' | 'unidade' | 'consulta'

export type ModeloCronograma = 'tecnico' | 'qualificacao' | 'distribuicao_diaria' | 'aprendizagem' | 'personalizado'
export type ModoQuantidadeEvento = 'carga' | 'quantidade' | 'manual'
export type TipoEventoPedagogico = 'estudo_ava' | 'sincrono' | 'presencial' | 'web_aula' | 'atendimento' | 'atividade' | 'recuperacao' | 'pratica_empresa' | 'matricula' | 'postagem_notas' | 'inicio_curso' | 'fim_curso' | 'inicio_modulo' | 'fim_modulo'
export interface RegraEventoCronograma { ativo?: boolean; modo?: ModoQuantidadeEvento; quantidade?: number; duracaoHoras?: number; diasPermitidos?: number[]; horario?: string }
export interface ConfiguracaoAprendizagem { faseIntensivaDiasUteis?: number; diasIntensivos?: number[]; diasAtendimentoRegular?: number[]; horarioWebaula?: string; duracaoWebaulaHoras?: number }
export interface ConfiguracaoCronograma { cargaDiaria?: number; diasEstudoPermitidos?: number[]; presencial?: RegraEventoCronograma; sincrono?: RegraEventoCronograma; praticaProfissional?: boolean; aprendizagem?: ConfiguracaoAprendizagem }
export interface ConfiguracaoItemCronograma extends ConfiguracaoCronograma {}
export interface Item { id: string; tipo: Tipo; nome: string; ch: number; pres: number; div: number; sincronos?: number; duracaoSincrono?: number; configuracaoCronograma?: ConfiguracaoItemCronograma }
export interface Modulo { id: string; nome: string; itens: Item[] }
export interface Regras { hEncontro: number; webDias: number; webHora: string; postDias: number; horario: string }
export type Modalidade = 'ead' | 'semipresencial' | 'presencial'
export type Categoria = 'iniciacao' | 'aprendizagem_basica' | 'qualificacao' | 'aperfeicoamento' | 'especializacao_prof' | 'aprendizagem_tecnica' | 'tecnico' | 'curso_livre' | 'graduacao_tecnologica' | 'graduacao' | 'pos_graduacao' | 'mestrado_doutorado'
export interface Curso { id: string; nome: string; categoria?: Categoria | ''; modalidade?: Modalidade | ''; modeloCronograma?: ModeloCronograma; configuracaoCronograma?: ConfiguracaoCronograma; chTotal: number; nota: string; regras: Regras; modulos: Modulo[]; resumo?: boolean }
export interface Pessoa { id: string; nome: string; papel: Papel }
export interface Unidade { id: string; nome: string; cidade?: string }
export interface Encontro { d: string; h: string; w: string }
export interface EventoPedagogico { id?: string; tipo: TipoEventoPedagogico; d: string; fim?: string; h?: string; duracaoHoras?: number; titulo?: string; observacao?: string }
export interface ItemTurma {
  enc?: Encontro[]; sin?: Encontro[]; eventos?: EventoPedagogico[]; rec?: string; evento?: string
  monitorId?: string; tutorId?: string; coordId?: string; profId?: string; ambiente?: string
  scorm?: string; apostila?: string; aval?: string; pesq?: string; media?: string; idm?: string
}
export interface Vigente { versao: number; por: string; em: string; ressalva: string }
export interface Turma {
  id: string; cursoId: string; nome: string; unidadeId: string; inicio: string; fimManual?: string; cursoSolicitado?: string; evento: string
  personalizarCronograma?: boolean; configuracaoCronograma?: ConfiguracaoCronograma
  monitorId: string; tutorId: string; coordId: string; profId: string; ambiente: string; obs?: string
  itens: Record<string, ItemTurma>
  status: Status; versao: number; rev: number; prazo: string; vigente: Vigente | null
}
/** [data, motivo, unidadeId?] — sem unidade vale para todas. */
export type Feriado = [string, string, string?]
export interface Catalogo { cursos: Curso[]; pessoas: Pessoa[]; feriados: Feriado[]; unidades: Unidade[] }
export interface Dados extends Catalogo { turmas: Turma[] }
export interface Me { id: number; nome: string; perfil: Perfil; unidades: string[]; validador: boolean; prazoDias: number; podeEquipe?: boolean }
export type TipoAcesso = 'equipe' | 'coordenador' | 'auxiliar' | 'consulta'
export interface Acesso { id: number; nome: string; email: string; login: string; tipo: TipoAcesso; unidades: string[]; ativo: boolean; ultimoAcesso: string; protegido: boolean; voce: boolean }
export interface AcessosLista { usuarios: Acesso[]; podeEquipe: boolean; loginUrl: string }
export interface AcessoNovo { nome: string; email: string; tipo: TipoAcesso; unidades: string[]; enviarEmail: boolean }
export interface AcessoCriado { usuario: Acesso; emailEnviado: boolean }
export interface Atividade { id: number; turmaId: string; versao: number; quem: string; acao: string; motivo: string; em: string }
export type SubtipoPedido = 'alteracao' | 'reabertura' | 'duvida'
export interface Aviso { id: number; turmaId: string; unidadeId: string; para: 'equipe' | 'unidade'; tipo: string; subtipo: string; titulo: string; texto: string; de: string; pedido: boolean; emailOk: boolean | null; em: string; lido: boolean; atendidoEm: string | null; atendidoPor: string; meu: boolean }
export interface AvisosResp { avisos: Aviso[]; naoLidos: number; pedidosAbertos: number }
export interface Boot { me: Me; catalogo: Catalogo; crev: number; turmas: Turma[] }

export interface LogItem { id: number; versao: number; quem: string; perfil: string; acao: string; motivo: string; detalhe: { campo: string; de: string; para: string }[] | null; em: string }
export interface VersaoInfo { versao: number; por: string; em: string; ressalva: string }
export interface Historico { log: LogItem[]; versoes: VersaoInfo[] }
export interface Snapshot { turma: Omit<Turma, 'status' | 'versao' | 'rev' | 'prazo' | 'vigente'>; curso: Curso; feriados: Feriado[]; unidade: Unidade | null; versao: number }
export interface VersaoCompleta extends VersaoInfo { snapshot: Snapshot }
export type AcaoNome = 'iniciar' | 'enviar' | 'recolher' | 'validar' | 'reabrir' | 'arquivar' | 'restaurar' | 'comentar'
