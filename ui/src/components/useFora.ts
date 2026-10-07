import { useEffect, useRef } from 'react'

/** Fecha o painel ao clicar fora ou apertar Esc. */
export function useFora(aberto: boolean, fechar: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!aberto) return
    const clique = (e: Event) => { const t = e.composedPath()[0] as Node; if (ref.current && !ref.current.contains(t)) fechar() }
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') fechar() }
    document.addEventListener('pointerdown', clique); document.addEventListener('keydown', tecla)
    return () => { document.removeEventListener('pointerdown', clique); document.removeEventListener('keydown', tecla) }
  }, [aberto, fechar])
  return ref
}
