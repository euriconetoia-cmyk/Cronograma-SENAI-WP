import type { Status } from '@/lib/types'
import { T } from '@/lib/texts'

const COR: Record<Status, string> = {
  solicitado: 'bg-accent text-accent-foreground',
  elaboracao: 'bg-secondary text-secondary-foreground',
  validacao: 'bg-warn-soft text-warn',
  validado: 'bg-ok-soft text-ok',
  arquivado: 'bg-muted text-muted-foreground line-through',
}

export function StatusBadge({ status, versao }: { status: Status; versao?: number }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 font-heading text-xs font-semibold ${COR[status]}`}>
      {T.status[status]}{versao && versao > 1 ? <span className="mono font-normal opacity-80">v{versao}</span> : null}
    </span>
  )
}
