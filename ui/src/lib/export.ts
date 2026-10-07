import { cursoTemMomentos, cursoTemPres, temPres, compute, momentos, feriadosDaTurma, toN, toS, workday, type Row } from './schedule'
import type { Curso, Feriado, Pessoa, Status, Turma, Unidade } from './types'
import { T } from './texts'

export interface ExportEntrada {
  turma: Pick<Turma, 'id' | 'nome' | 'inicio' | 'evento' | 'monitorId' | 'tutorId' | 'coordId' | 'profId' | 'ambiente' | 'itens' | 'unidadeId' | 'fimManual'>
  curso: Curso
  feriados: Feriado[]
  pessoas: Pessoa[]
  unidade?: Unidade | null
  status: Status
  versao: number
  /** Texto de validação, quando houver: "Validado por X em dd/mm/aaaa (versão 2)". */
  validacao?: string
  geradoEm?: string
  /** Colunas de suporte (SCORM, apostila, ID Moodle…) são da Unidigit@l; a unidade não recebe. */
  suporte?: boolean
}

type V = string | number | Date | null | undefined
export interface Col { chave: string; titulo: string; grupo: 'prazos' | 'equipe' | 'encontros' | 'presencial' | 'suporte'; nivel: 'item' | 'enc'; largura: number; tipo: 'texto' | 'num' | 'data' | 'centro'; pdf: boolean }
export interface Linha { mod?: string; tipo?: string; celulas: V[]; primeira: boolean; span: number }
export interface Modelo { titulo: string; sub: string; estado: string; colunas: Col[]; linhas: Linha[]; feriados: Feriado[]; arquivo: string; geradoEm: string }

const COLS: Col[] = [
  { chave: 'uc', titulo: 'Unidade curricular', grupo: 'prazos', nivel: 'item', largura: 38, tipo: 'texto', pdf: true },
  { chave: 'ch', titulo: 'CH total', grupo: 'prazos', nivel: 'item', largura: 8, tipo: 'num', pdf: true },
  { chave: 'pres', titulo: 'CH pres.', grupo: 'prazos', nivel: 'item', largura: 8, tipo: 'num', pdf: true },
  { chave: 'dist', titulo: 'CH dist.', grupo: 'prazos', nivel: 'item', largura: 8, tipo: 'num', pdf: true },
  { chave: 'dias', titulo: 'Dias de estudo EaD', grupo: 'prazos', nivel: 'item', largura: 10, tipo: 'num', pdf: true },
  { chave: 'ini', titulo: 'Início', grupo: 'prazos', nivel: 'item', largura: 11, tipo: 'data', pdf: true },
  { chave: 'fim', titulo: 'Término', grupo: 'prazos', nivel: 'item', largura: 11, tipo: 'data', pdf: true },
  { chave: 'ava', titulo: 'Término AVA', grupo: 'prazos', nivel: 'item', largura: 11, tipo: 'data', pdf: true },
  { chave: 'evento', titulo: 'Evento', grupo: 'prazos', nivel: 'item', largura: 10, tipo: 'texto', pdf: true },
  { chave: 'monitor', titulo: 'Monitor', grupo: 'equipe', nivel: 'item', largura: 20, tipo: 'texto', pdf: true },
  { chave: 'tutor', titulo: 'Tutor', grupo: 'equipe', nivel: 'item', largura: 20, tipo: 'texto', pdf: true },
  { chave: 'n', titulo: 'Momento', grupo: 'encontros', nivel: 'enc', largura: 5, tipo: 'centro', pdf: true },
  { chave: 'denc', titulo: 'Data do momento', grupo: 'encontros', nivel: 'enc', largura: 11, tipo: 'data', pdf: true },
  { chave: 'hor', titulo: 'Horário', grupo: 'encontros', nivel: 'enc', largura: 17, tipo: 'texto', pdf: true },
  { chave: 'recdia', titulo: 'Dia da recuperação', grupo: 'encontros', nivel: 'item', largura: 13, tipo: 'texto', pdf: true },
  { chave: 'web', titulo: 'Webconferência de alinhamento', grupo: 'encontros', nivel: 'enc', largura: 17, tipo: 'data', pdf: true },
  { chave: 'webh', titulo: 'Hora', grupo: 'encontros', nivel: 'enc', largura: 6, tipo: 'centro', pdf: true },
  { chave: 'post', titulo: 'Postagem das notas', grupo: 'encontros', nivel: 'enc', largura: 12, tipo: 'data', pdf: true },
  { chave: 'coord', titulo: 'Coordenador técnico', grupo: 'presencial', nivel: 'item', largura: 20, tipo: 'texto', pdf: true },
  { chave: 'prof', titulo: 'Professor presencial', grupo: 'presencial', nivel: 'item', largura: 20, tipo: 'texto', pdf: true },
  { chave: 'amb', titulo: 'Ambiente', grupo: 'presencial', nivel: 'item', largura: 16, tipo: 'texto', pdf: true },
  { chave: 'scorm', titulo: 'SCORM', grupo: 'suporte', nivel: 'item', largura: 12, tipo: 'texto', pdf: false },
  { chave: 'apostila', titulo: 'Apostila', grupo: 'suporte', nivel: 'item', largura: 12, tipo: 'texto', pdf: false },
  { chave: 'aval', titulo: 'Avaliação', grupo: 'suporte', nivel: 'item', largura: 12, tipo: 'texto', pdf: false },
  { chave: 'pesq', titulo: 'Pesquisa', grupo: 'suporte', nivel: 'item', largura: 12, tipo: 'texto', pdf: false },
  { chave: 'media', titulo: 'Média do SCORM', grupo: 'suporte', nivel: 'item', largura: 12, tipo: 'texto', pdf: false },
  { chave: 'idm', titulo: 'ID Moodle', grupo: 'suporte', nivel: 'item', largura: 12, tipo: 'texto', pdf: false },
]
export const GRUPO_NOME = T.cron.grupos

export const ROTULO_STATUS: Record<Status, string> = { solicitado: 'Solicitada', elaboracao: 'Em elaboração', validacao: 'Em validação pela unidade', validado: 'Validado', arquivado: 'Arquivado' }

const dt = (s?: string | null): Date | null => (s ? new Date(toN(s) * 864e5) : null)
export const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '')

export function montarModelo(e: ExportEntrada): Modelo {
  const { turma: t, curso, pessoas } = e
  const G = compute(t, curso, e.feriados)
  const R = curso.regras
  const nome = (id?: string) => pessoas.find(p => p.id === id)?.nome || ''
  const linhas: Linha[] = []
  const idx = Object.fromEntries(COLS.map((c, i) => [c.chave, i]))
  curso.modulos.forEach(m => {
    linhas.push({ mod: m.nome, celulas: [], primeira: true, span: 1 })
    m.itens.forEach(it => {
      const r: Row = G.by[it.id], c = r.c, st = t.itens[it.id] || {}
      const enc = momentos(t, r, curso)
      const n = Math.max(1, enc.length)
      for (let i = 0; i < n; i++) {
        const x = enc[i]
        const cel: V[] = new Array(COLS.length).fill(null)
        const set = (k: string, v: V) => { cel[idx[k]] = v }
        if (i === 0) {
          set('uc', it.nome); set('ch', it.ch); set('pres', it.pres); set('dist', c.H); set('dias', c.I)
          set('ini', dt(c.J)); set('fim', dt(c.K)); set('ava', dt(c.L)); set('evento', st.evento || t.evento)
          set('monitor', nome(st.monitorId || t.monitorId)); set('tutor', nome(st.tutorId || t.tutorId))
          set('recdia', it.tipo === 'uc' ? st.rec || '-' : '')
          if (temPres(it)) { set('coord', nome(st.coordId || t.coordId)); set('prof', nome(st.profId || t.profId)); set('amb', st.ambiente || t.ambiente) }
          set('scorm', st.scorm); set('apostila', st.apostila); set('aval', st.aval); set('pesq', st.pesq); set('media', st.media); set('idm', st.idm)
        }
        if (enc.length || it.tipo === 'mat') set('n', it.tipo === 'uc' && x ? `${enc.slice(0, i + 1).filter(a => a.tipo === x.tipo).length}º ${x.tipo === 'sincrono' ? 'Sínc.' : 'Pres.'}` : it.tipo === 'mat' ? 'R' : '-')
        if ((it.tipo === 'uc' || it.tipo === 'intro') && !x) { /* sem momento configurado */ }
        else if (it.tipo === 'uc' || it.tipo === 'intro') {
          set('denc', dt(x?.d)); set('hor', x?.h || ''); set('webh', x?.w || '')
          set('web', x?.d ? dt(toS(toN(x.d) - R.webDias)) : null)
          set('post', x?.d ? dt(workday(x.d, R.postDias, new Set(feriadosDaTurma(t, e.feriados).map(f => f[0])))) : null)
        } else if (it.tipo === 'rec') { set('denc', '-'); set('hor', '-') }
        linhas.push({ tipo: it.tipo, celulas: cel, primeira: i === 0, span: n })
      }
    })
  })
  let colunas = COLS
  const semPres = !cursoTemPres(curso)
  const semMomentos = !cursoTemMomentos(curso)
  if (e.suporte === false || semPres || semMomentos) {
    const keep = COLS.map(c => (e.suporte !== false || c.grupo !== 'suporte') && !(semMomentos && c.grupo === 'encontros') && !(semPres && c.grupo === 'presencial'))
    colunas = COLS.filter((_, i) => keep[i])
    linhas.forEach(l => { if (!l.mod) l.celulas = l.celulas.filter((_, i) => keep[i]) })
  }
  const un = e.unidade?.nome || ''
  const hoje = e.geradoEm || new Date().toLocaleDateString('pt-BR')
  const estado = [ROTULO_STATUS[e.status], `versão ${e.versao}`, e.validacao].filter(Boolean).join(' · ')
  return {
    titulo: `Cronograma do curso ${curso.nome}`,
    sub: [un && `Unidade ${un}`, curso.categoria && T.categoria[curso.categoria]?.nome, curso.modalidade && `Modalidade ${T.modalidade[curso.modalidade]}`, `Turma ${t.nome}`, t.inicio && `Início ${t.inicio.split('-').reverse().join('/')}`, (t.fimManual || G.end) && `Término previsto ${(t.fimManual || G.end)!.split('-').reverse().join('/')}`].filter(Boolean).join(' · '),
    estado, colunas, linhas, feriados: feriadosDaTurma(t, e.feriados), geradoEm: hoje,
    arquivo: `cronograma_${slug(t.nome)}_v${e.versao}${e.status === 'validado' ? '_validado' : ''}`,
  }
}

import logoUrl from '@/assets/senai-logo.png?inline'
const LOGO_PROP = 400 / 106

const COR = { brand: '0D2A52', primary: '0B4F9C', cab: 'E3E9F2', mod: 'DFE6F1', intro: 'E2F2E6', rec: 'FFF6C9', borda: 'B8C2D0' }
const GRUPOS: Col['grupo'][] = ['prazos', 'equipe', 'encontros', 'presencial', 'suporte']

export async function gerarExcel(m: Modelo): Promise<Blob> {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Unidigit@l · Cronogramas EaD'; wb.created = new Date()
  const ws = wb.addWorksheet('Cronograma', { views: [{ state: 'frozen', xSplit: 1, ySplit: 6 }], pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 } })
  const cols = m.colunas, N = cols.length
  const logoId = wb.addImage({ base64: logoUrl, extension: 'png' })
  cols.forEach((c, i) => { ws.getColumn(i + 1).width = c.largura })
  const borda = { style: 'thin' as const, color: { argb: 'FF' + COR.borda } }
  const bordas = { top: borda, left: borda, bottom: borda, right: borda }
  const topo = (r: number, txt: string, size: number, bold = false, cor = '000000') => {
    ws.mergeCells(r, 1, r, Math.min(N, 14)); const c = ws.getCell(r, 1); c.value = txt; c.font = { name: 'Arial', size, bold, color: { argb: 'FF' + cor } }; c.alignment = { vertical: 'middle' }
  }
  topo(1, m.titulo, 15, true, COR.brand); ws.getRow(1).height = 24
  ws.addImage(logoId, { tl: { col: Math.max(N - 2.6, 0), row: 0.15 }, ext: { width: 150, height: 40 } })
  topo(2, m.sub, 10); topo(3, m.estado, 10, true, m.estado.includes('Validado') ? '1E6B3A' : '8A4B00'); topo(4, `Gerado em ${m.geradoEm}`, 8, false, '5B6778')
  // grupos
  let col = 1
  GRUPOS.forEach((g, gi) => {
    const n = cols.filter(c => c.grupo === g).length
    if (!n) return
    if (n > 1) ws.mergeCells(5, col, 5, col + n - 1)
    const c = ws.getCell(5, col); c.value = GRUPO_NOME[g].toUpperCase()
    for (let k = col; k < col + n; k++) { const x = ws.getCell(5, k); x.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + (gi % 2 ? COR.brand : COR.primary) } }; x.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } }; x.alignment = { horizontal: 'center', vertical: 'middle' }; x.border = bordas }
    col += n
  })
  cols.forEach((c, i) => { const x = ws.getCell(6, i + 1); x.value = c.titulo; x.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COR.cab } }; x.font = { name: 'Arial', size: 9, bold: true }; x.alignment = { wrapText: true, vertical: 'middle', horizontal: c.tipo === 'texto' ? 'left' : 'center' }; x.border = bordas })
  ws.getRow(6).height = 38
  let r = 7
  const mescla: [number, number, number][] = []
  m.linhas.forEach(l => {
    if (l.mod) {
      ws.mergeCells(r, 1, r, N); const c = ws.getCell(r, 1); c.value = l.mod.toUpperCase(); c.font = { name: 'Arial', size: 9, bold: true }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COR.mod } }; c.border = bordas
      r++; return
    }
    const cor = l.tipo === 'intro' || l.tipo === 'mat' ? COR.intro : l.tipo === 'rec' ? COR.rec : 'FFFFFF'
    cols.forEach((c, i) => {
      const x = ws.getCell(r, i + 1), v = l.celulas[i]
      if (v instanceof Date) { x.value = v; x.numFmt = 'dd/mm/yyyy' } else if (v !== null && v !== undefined && v !== '') x.value = v
      x.font = { name: 'Arial', size: 9, bold: i === 0 }
      x.alignment = { vertical: 'middle', wrapText: c.tipo === 'texto', horizontal: c.tipo === 'texto' ? 'left' : c.tipo === 'num' ? 'right' : 'center' }
      x.border = bordas; x.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + cor } }
    })
    if (l.primeira && l.span > 1) cols.forEach((c, i) => { if (c.nivel === 'item') mescla.push([i + 1, r, r + l.span - 1]) })
    r++
  })
  mescla.forEach(([c, a, b]) => ws.mergeCells(a, c, b, c))
  // feriados considerados
  const wf = wb.addWorksheet('Feriados considerados')
  wf.columns = [{ header: 'Data', width: 14 }, { header: 'Motivo', width: 50 }, { header: 'Vale para', width: 18 }]
  wf.getRow(1).font = { bold: true }
  m.feriados.forEach(f => { const row = wf.addRow([new Date(toN(f[0]) * 864e5), f[1], f[2] ? 'Unidade' : 'Todas as unidades']); row.getCell(1).numFmt = 'dd/mm/yyyy' })
  const buf = await wb.xlsx.writeBuffer()
  return new Blob([buf as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

const fmtD = (d: Date) => `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCFullYear()).slice(2)}`

export async function gerarPdf(m: Modelo): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' })
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), mg = 10
  doc.setProperties({ title: m.titulo, subject: m.sub, author: 'Unidigit@l' })
  const cols = m.colunas.map((c, i) => ({ c, i })).filter(x => x.c.pdf)
  const rgb = (h: string) => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)] as [number, number, number]
  const gruposPdf = GRUPOS.map(g => ({ g, n: cols.filter(x => x.c.grupo === g).length })).filter(x => x.n)
  const head = [
    gruposPdf.map((x, k) => ({ content: GRUPO_NOME[x.g].toUpperCase(), colSpan: x.n, styles: { halign: 'center' as const, fillColor: rgb(k % 2 ? COR.brand : COR.primary), textColor: [255, 255, 255] as [number, number, number], fontStyle: 'bold' as const } })),
    cols.map(x => ({ content: x.c.titulo, styles: { halign: (x.c.tipo === 'texto' ? 'left' : 'center') as 'left' | 'center', fillColor: rgb(COR.cab), textColor: [20, 30, 45] as [number, number, number], fontStyle: 'bold' as const } })),
  ]
  const body = m.linhas.map(l => {
    if (l.mod) return [{ content: l.mod.toUpperCase(), colSpan: cols.length, styles: { fillColor: rgb(COR.mod), fontStyle: 'bold' as const } }]
    const fill = l.tipo === 'intro' || l.tipo === 'mat' ? rgb(COR.intro) : l.tipo === 'rec' ? rgb(COR.rec) : ([255, 255, 255] as [number, number, number])
    return cols.filter(x => l.primeira || x.c.nivel === 'enc').map(x => {
      const v = l.celulas[x.i]
      const txt = v instanceof Date ? fmtD(v) : v === null || v === undefined ? '' : String(v)
      return { content: txt, rowSpan: l.primeira && x.c.nivel === 'item' ? l.span : 1, styles: { fillColor: fill, halign: (x.c.tipo === 'texto' ? 'left' : x.c.tipo === 'num' ? 'right' : 'center') as 'left' | 'right' | 'center', fontStyle: x.i === 0 ? ('bold' as const) : ('normal' as const), valign: 'middle' as const } }
    })
  })
  const larg = cols.reduce((s, x) => s + x.c.largura, 0)
  const escala = (W - 2 * mg) / larg
  const columnStyles = Object.fromEntries(cols.map((x, k) => [k, { cellWidth: x.c.largura * escala }]))
  autoTable(doc, {
    head, body, startY: 34, margin: { left: mg, right: mg, top: 30, bottom: 14 }, theme: 'grid', columnStyles,
    styles: { font: 'helvetica', fontSize: 7, cellPadding: 1.1, lineColor: rgb(COR.borda), lineWidth: 0.1, overflow: 'linebreak' },
    didDrawPage: () => {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...rgb(COR.brand)); doc.text(m.titulo, mg, 14)
      try { const lh = 13; doc.addImage(logoUrl, 'PNG', W - mg - lh * LOGO_PROP, 6, lh * LOGO_PROP, lh) } catch { /* logo é opcional */ }
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(40, 50, 65); doc.text(m.sub, mg, 20)
      doc.setFont('helvetica', 'bold'); doc.setTextColor(...(m.estado.includes('Validado') ? ([30, 107, 58] as [number, number, number]) : ([138, 75, 0] as [number, number, number]))); doc.text(m.estado, mg, 26)
    },
  })
  const n = doc.getNumberOfPages()
  for (let p = 1; p <= n; p++) {
    doc.setPage(p); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(90, 100, 115)
    doc.text(`Unidigit@l · Cronogramas EaD · gerado em ${m.geradoEm}`, mg, H - 6)
    doc.text(`Página ${p} de ${n}`, W - mg, H - 6, { align: 'right' })
  }
  return doc.output('blob')
}

/** Baixa o arquivo. Devolve false se o navegador não permitir. */
export function baixar(blob: Blob, nome: string): boolean {
  try {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
    return true
  } catch { return false }
}
