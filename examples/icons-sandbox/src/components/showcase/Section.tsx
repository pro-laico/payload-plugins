import type { ReactNode } from 'react'

/** A titled showcase section. */
export const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="space-y-3">
    <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">{title}</span>
    <div className="flex flex-wrap items-end gap-x-6 gap-y-4">{children}</div>
  </section>
)
