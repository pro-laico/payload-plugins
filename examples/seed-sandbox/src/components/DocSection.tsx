import type { ReactNode } from 'react'
import { EmptyState } from '@pro-laico/sandbox-shell'

export type DocSectionItem = { id: string | number; primary: ReactNode; secondary?: ReactNode }

/** A titled, counted list of seeded docs — one line per doc, EmptyState until the seed runs. */
export function DocSection({ title, items }: { title: string; items: DocSectionItem[] }) {
  return (
    <>
      <h2>
        {title}{' '}
        <small className="shell-muted" style={{ fontWeight: 400 }}>
          ({items.length})
        </small>
      </h2>
      {items.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="shell-card">
          {items.map((item) => (
            <p key={item.id} style={{ margin: '4px 0' }}>
              <strong>{item.primary}</strong> {item.secondary != null && <small className="shell-muted">{item.secondary}</small>}
            </p>
          ))}
        </div>
      )}
    </>
  )
}
