export type ModeloCronograma = 'tecnico' | 'qualificacao' | 'distribuicao_diaria' | 'aprendizagem' | 'personalizado'
export type ModoQuantidadeEvento = 'carga' | 'quantidade' | 'manual'
export type TipoEventoConfiguravel = 'presencial' | 'sincrono'

export interface RegraEventoPerfil {
  ativo: boolean
  modo: ModoQuantidadeEvento
  quantidade?: number
  duracaoHoras?: number
  diasPermitidos: number[]
  horario?: string
}

export interface ConfiguracaoAprendizagemResolvida {
  faseIntensivaDiasUteis: number
  diasIntensivos: number[]
  diasAtendimentoRegular: number[]
  horarioWebaula?: string
  duracaoWebaulaHoras: number
}

export interface PerfilCronogramaResolvido {
  modelo: ModeloCronograma
  cargaDiaria?: number
  diasEstudoPermitidos: number[]
  presencial: RegraEventoPerfil
  sincrono: RegraEventoPerfil
  praticaProfissional: boolean
  aprendizagem?: ConfiguracaoAprendizagemResolvida
}

type EventoParcial = Partial<Omit<RegraEventoPerfil, 'diasPermitidos'>> & { diasPermitidos?: number[] }
type ConfigParcial = {
  cargaDiaria?: number
  diasEstudoPermitidos?: number[]
  presencial?: EventoParcial
  sincrono?: EventoParcial
  praticaProfissional?: boolean
  aprendizagem?: { faseIntensivaDiasUteis?: number; diasIntensivos?: number[]; diasAtendimentoRegular?: number[]; horarioWebaula?: string; duracaoWebaulaHoras?: number }
}
type ItemLike = {
  ch?: number
  pres?: number
  div?: number
  sincronos?: number
  configuracaoCronograma?: ConfigParcial
}
type CursoLike = {
  modeloCronograma?: ModeloCronograma
  configuracaoCronograma?: ConfigParcial
  regras?: { hEncontro?: number; horario?: string }
}

const DIAS_UTEIS = [1, 2, 3, 4, 5]
const SABADO = [6]

const PRESETS: Record<Exclude<ModeloCronograma, 'personalizado'>, PerfilCronogramaResolvido> = {
  tecnico: {
    modelo: 'tecnico',
    diasEstudoPermitidos: DIAS_UTEIS,
    presencial: { ativo: true, modo: 'carga', duracaoHoras: 8, diasPermitidos: SABADO },
    sincrono: { ativo: false, modo: 'quantidade', quantidade: 0, duracaoHoras: 2, diasPermitidos: DIAS_UTEIS },
    praticaProfissional: false,
  },
  qualificacao: {
    modelo: 'qualificacao',
    diasEstudoPermitidos: DIAS_UTEIS,
    presencial: { ativo: true, modo: 'carga', duracaoHoras: 8, diasPermitidos: SABADO },
    sincrono: { ativo: false, modo: 'quantidade', quantidade: 0, duracaoHoras: 2, diasPermitidos: DIAS_UTEIS },
    praticaProfissional: false,
  },
  distribuicao_diaria: {
    modelo: 'distribuicao_diaria',
    cargaDiaria: 3,
    diasEstudoPermitidos: DIAS_UTEIS,
    presencial: { ativo: false, modo: 'manual', quantidade: 0, duracaoHoras: 3, diasPermitidos: DIAS_UTEIS },
    sincrono: { ativo: false, modo: 'manual', quantidade: 0, duracaoHoras: 2, diasPermitidos: DIAS_UTEIS },
    praticaProfissional: false,
  },
  aprendizagem: {
    modelo: 'aprendizagem',
    diasEstudoPermitidos: DIAS_UTEIS,
    presencial: { ativo: false, modo: 'carga', duracaoHoras: 8, diasPermitidos: SABADO },
    sincrono: { ativo: true, modo: 'quantidade', quantidade: 0, duracaoHoras: 2, diasPermitidos: DIAS_UTEIS },
    praticaProfissional: true,
    aprendizagem: { faseIntensivaDiasUteis: 23, diasIntensivos: DIAS_UTEIS, diasAtendimentoRegular: [1, 2], horarioWebaula: '13:30 às 17:00', duracaoWebaulaHoras: 3.5 },
  },
}

const diasValidos = (dias: number[] | undefined, fallback: number[]) => {
  const limpos = (dias || []).filter(d => Number.isInteger(d) && d >= 0 && d <= 6)
  return limpos.length ? [...new Set(limpos)] : [...fallback]
}

const numeroPositivo = (v: unknown, fallback: number | undefined) => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : fallback
}


const mesclarAprendizagem = (base: ConfiguracaoAprendizagemResolvida | undefined, override?: ConfigParcial['aprendizagem']): ConfiguracaoAprendizagemResolvida | undefined => {
  if (!base && !override) return undefined
  const b = base || { faseIntensivaDiasUteis: 0, diasIntensivos: DIAS_UTEIS, diasAtendimentoRegular: [1, 2], duracaoWebaulaHoras: 2 }
  return {
    faseIntensivaDiasUteis: Math.max(0, Math.floor(Number(override?.faseIntensivaDiasUteis ?? b.faseIntensivaDiasUteis) || 0)),
    diasIntensivos: diasValidos(override?.diasIntensivos, b.diasIntensivos),
    diasAtendimentoRegular: diasValidos(override?.diasAtendimentoRegular, b.diasAtendimentoRegular),
    horarioWebaula: override?.horarioWebaula ?? b.horarioWebaula,
    duracaoWebaulaHoras: numeroPositivo(override?.duracaoWebaulaHoras, b.duracaoWebaulaHoras) || 2,
  }
}

const mesclarEvento = (base: RegraEventoPerfil, override?: EventoParcial): RegraEventoPerfil => ({
  ativo: override?.ativo ?? base.ativo,
  modo: override?.modo ?? base.modo,
  quantidade: override?.quantidade ?? base.quantidade,
  duracaoHoras: numeroPositivo(override?.duracaoHoras, base.duracaoHoras),
  diasPermitidos: diasValidos(override?.diasPermitidos, base.diasPermitidos),
  horario: override?.horario ?? base.horario,
})

export function resolverPerfilCronograma(curso: CursoLike): PerfilCronogramaResolvido {
  const modelo = curso.modeloCronograma || 'qualificacao'
  const base = modelo === 'personalizado'
    ? { ...PRESETS.qualificacao, modelo: 'personalizado' as const }
    : PRESETS[modelo]
  const cfg = curso.configuracaoCronograma || {}
  const hEncontro = numeroPositivo(curso.regras?.hEncontro, base.presencial.duracaoHoras)
  const presencialBase = { ...base.presencial, duracaoHoras: hEncontro, horario: curso.regras?.horario || base.presencial.horario }
  return {
    modelo,
    cargaDiaria: numeroPositivo(cfg.cargaDiaria, base.cargaDiaria),
    diasEstudoPermitidos: diasValidos(cfg.diasEstudoPermitidos, base.diasEstudoPermitidos),
    presencial: mesclarEvento(presencialBase, cfg.presencial),
    sincrono: mesclarEvento(base.sincrono, cfg.sincrono),
    praticaProfissional: cfg.praticaProfissional ?? base.praticaProfissional,
    aprendizagem: mesclarAprendizagem(base.aprendizagem, cfg.aprendizagem),
  }
}

export function resolverPerfilItem(item: ItemLike, curso: CursoLike): PerfilCronogramaResolvido {
  const base = resolverPerfilCronograma(curso)
  const cfg = item.configuracaoCronograma || {}
  return {
    ...base,
    cargaDiaria: numeroPositivo(cfg.cargaDiaria, base.cargaDiaria),
    diasEstudoPermitidos: diasValidos(cfg.diasEstudoPermitidos, base.diasEstudoPermitidos),
    presencial: mesclarEvento(base.presencial, cfg.presencial),
    sincrono: mesclarEvento(base.sincrono, cfg.sincrono),
    praticaProfissional: cfg.praticaProfissional ?? base.praticaProfissional,
    aprendizagem: mesclarAprendizagem(base.aprendizagem, cfg.aprendizagem),
  }
}

export function diasEstudoItem(item: ItemLike, curso: CursoLike): number {
  const cargaEad = Math.max(0, Number(item.ch || 0) - Number(item.pres || 0))
  if (cargaEad === 0) return 0
  const perfil = resolverPerfilItem(item, curso)
  if (perfil.modelo === 'distribuicao_diaria' && perfil.cargaDiaria) return Math.ceil(cargaEad / perfil.cargaDiaria)
  if (cargaEad === 21) return 7
  return Math.ceil(cargaEad / (numeroPositivo(item.div, 3) || 3))
}

export function quantidadeEventosItem(item: ItemLike, curso: CursoLike, tipo: TipoEventoConfiguravel): number {
  const perfil = resolverPerfilItem(item, curso)
  const regra = perfil[tipo]
  if (!regra.ativo) return 0
  const itemCfg = item.configuracaoCronograma?.[tipo]
  if (itemCfg?.quantidade !== undefined) return Math.max(0, Math.floor(Number(itemCfg.quantidade || 0)))
  if (tipo === 'sincrono' && Number.isFinite(Number(item.sincronos)) && Number(item.sincronos) >= 0 && item.sincronos !== undefined) {
    return Math.floor(Number(item.sincronos))
  }
  if (regra.modo === 'quantidade') return Math.max(0, Math.floor(Number(regra.quantidade || 0)))
  if (regra.modo === 'manual') return Math.max(0, Math.floor(Number(regra.quantidade || 0)))
  const carga = Math.max(0, Number(item.pres || 0))
  const duracao = numeroPositivo(regra.duracaoHoras, numeroPositivo(curso.regras?.hEncontro, 8)) || 8
  return carga > 0 ? Math.ceil(carga / duracao) : 0
}

export function diasPermitidosEvento(item: ItemLike, curso: CursoLike, tipo: TipoEventoConfiguravel): number[] {
  const perfil = resolverPerfilItem(item, curso)
  return diasValidos(perfil[tipo].diasPermitidos, tipo === 'presencial' ? SABADO : DIAS_UTEIS)
}

export function duracaoEventoItem(item: ItemLike, curso: CursoLike, tipo: TipoEventoConfiguravel): number {
  const perfil = resolverPerfilItem(item, curso)
  return numeroPositivo(perfil[tipo].duracaoHoras, tipo === 'presencial' ? 8 : 2) || (tipo === 'presencial' ? 8 : 2)
}


export const MODELO_LABEL: Record<ModeloCronograma, string> = {
  tecnico: 'Técnico',
  qualificacao: 'Qualificação',
  distribuicao_diaria: 'Distribuição diária',
  aprendizagem: 'Aprendizagem',
  personalizado: 'Personalizado',
}

export function mesclarConfiguracaoCronograma(base: ConfigParcial = {}, override: ConfigParcial = {}): ConfigParcial {
  return {
    ...base,
    ...override,
    presencial: override.presencial ? { ...(base.presencial || {}), ...override.presencial } : base.presencial,
    sincrono: override.sincrono ? { ...(base.sincrono || {}), ...override.sincrono } : base.sincrono,
    aprendizagem: override.aprendizagem ? { ...(base.aprendizagem || {}), ...override.aprendizagem } : base.aprendizagem,
    diasEstudoPermitidos: override.diasEstudoPermitidos ?? base.diasEstudoPermitidos,
  }
}

export function aplicarConfiguracaoTurma<T extends CursoLike & { configuracaoCronograma?: ConfigParcial }>(
  curso: T,
  turma?: { personalizarCronograma?: boolean; configuracaoCronograma?: ConfigParcial }
): T {
  if (!turma?.personalizarCronograma) return curso
  return {
    ...curso,
    configuracaoCronograma: mesclarConfiguracaoCronograma(curso.configuracaoCronograma || {}, turma.configuracaoCronograma || {}),
  }
}

export function validarConfiguracaoModelo(curso: CursoLike): string[] {
  const p = resolverPerfilCronograma(curso)
  const erros: string[] = []
  if (p.modelo === 'distribuicao_diaria' && (!p.cargaDiaria || p.cargaDiaria <= 0)) erros.push('Informe uma carga diária maior que zero.')
  if (p.modelo === 'aprendizagem') {
    const a = p.aprendizagem
    if (!a) erros.push('Configuração de Aprendizagem ausente.')
    else {
      if (a.faseIntensivaDiasUteis > 0 && a.diasIntensivos.length === 0) erros.push('Selecione ao menos um dia para a fase intensiva.')
      if (a.diasAtendimentoRegular.length === 0) erros.push('Selecione ao menos um dia para o atendimento semanal.')
      if (a.duracaoWebaulaHoras <= 0) erros.push('A duração da webaula deve ser maior que zero.')
    }
  }
  if (p.presencial.ativo && p.presencial.diasPermitidos.length === 0) erros.push('Selecione ao menos um dia para encontros presenciais.')
  if (p.sincrono.ativo && p.sincrono.diasPermitidos.length === 0) erros.push('Selecione ao menos um dia para momentos síncronos.')
  return erros
}
