import { useState } from 'react'
import { toast } from 'sonner'
import { FileSpreadsheet, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { baixar, gerarExcel, gerarPdf, montarModelo, type ExportEntrada } from '@/lib/export'
import { T } from '@/lib/texts'

/** Monta o modelo na hora do clique, para o arquivo sair igual ao que está na tela. */
export function useExportar(entrada: () => ExportEntrada) {
  const [busy, setBusy] = useState<'xlsx' | 'pdf' | null>(null)
  const go = async (tipo: 'xlsx' | 'pdf') => {
    setBusy(tipo)
    try {
      const m = montarModelo(entrada())
      const blob = tipo === 'xlsx' ? await gerarExcel(m) : await gerarPdf(m)
      const nome = `${m.arquivo}.${tipo}`
      toast(baixar(blob, nome) ? T.exportar.pronto(nome) : T.exportar.bloqueado)
    } catch { toast(T.exportar.falha) } finally { setBusy(null) }
  }
  return { busy, go }
}

export function ExportButtons({ entrada, size = 'default', escuro }: { entrada: () => ExportEntrada; size?: 'default' | 'sm'; escuro?: boolean }) {
  const cls = escuro ? 'border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white' : ''
  const [busy, setBusy] = useState<'xlsx' | 'pdf' | null>(null)
  const go = async (tipo: 'xlsx' | 'pdf') => {
    setBusy(tipo)
    try {
      const m = montarModelo(entrada())
      const blob = tipo === 'xlsx' ? await gerarExcel(m) : await gerarPdf(m)
      const nome = `${m.arquivo}.${tipo}`
      toast(baixar(blob, nome) ? T.exportar.pronto(nome) : T.exportar.bloqueado)
    } catch { toast(T.exportar.falha) } finally { setBusy(null) }
  }
  return (
    <>
      <Button size={size} variant="outline" className={cls} disabled={!!busy} onClick={() => void go('xlsx')}><FileSpreadsheet size={15} />{busy === 'xlsx' ? T.exportar.gerando : T.exportar.excel}</Button>
      <Button size={size} variant="outline" className={cls} disabled={!!busy} onClick={() => void go('pdf')}><FileText size={15} />{busy === 'pdf' ? T.exportar.gerando : T.exportar.pdf}</Button>
    </>
  )
}
