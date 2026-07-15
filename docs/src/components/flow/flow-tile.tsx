/** Tile visual for the Flow diagram component — a titled card with a kind badge. */
export type TileKind = 'start' | 'step' | 'check' | 'result' | 'store'

export interface TileData {
  id: string
  label: string
  detail?: string
  kind?: TileKind
}

const KIND_CLASS: Record<TileKind, string> = {
  start: 'border-fd-primary/40 bg-fd-primary/5',
  step: 'border-fd-border bg-fd-card',
  check: 'border-amber-500/50 bg-amber-500/5',
  result: 'border-emerald-500/40 bg-emerald-500/5',
  store: 'border-violet-500/40 bg-violet-500/5',
}

const KIND_BADGE: Partial<Record<TileKind, string>> = {
  check: 'text-amber-600 dark:text-amber-400',
  result: 'text-emerald-600 dark:text-emerald-400',
  store: 'text-violet-600 dark:text-violet-400',
}

const KIND_LABEL: Partial<Record<TileKind, string>> = { check: 'check', result: 'response', store: 'stored' }

export function FlowTile({ tile }: { tile: TileData }) {
  const kind = tile.kind ?? 'step'
  const badge = KIND_LABEL[kind]
  return (
    <div className={`w-56 rounded-lg border px-4 py-3 text-left shadow-sm ${KIND_CLASS[kind]}`}>
      {badge ? (
        <span className={`mb-1 block text-[0.65rem] font-medium uppercase tracking-wider ${KIND_BADGE[kind] ?? ''}`}>{badge}</span>
      ) : null}
      <span className="block text-sm font-medium leading-snug text-fd-foreground">{tile.label}</span>
      {tile.detail ? <span className="mt-1 block text-xs leading-snug text-fd-muted-foreground">{tile.detail}</span> : null}
    </div>
  )
}
