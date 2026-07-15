import type { ReactNode } from 'react'

export function EmptyState({ children }: { children?: ReactNode }) {
  return <p className="shell-empty">{children ?? 'Nothing here yet — seed the database above.'}</p>
}
