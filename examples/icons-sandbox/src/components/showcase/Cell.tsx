import type { ReactNode } from 'react'

/** A labeled showcase cell. `span` not `code` — the shell's chip styling would swallow the tiny label. */
export const Cell = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex flex-col items-center gap-2">
    <div className="flex h-12 items-center justify-center">{children}</div>
    <span className="font-mono text-[11px] text-muted-foreground">{label}</span>
  </div>
)
