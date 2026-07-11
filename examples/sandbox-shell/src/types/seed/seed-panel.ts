import type { ReactNode } from 'react'

export type SeedPanelProps = {
  seeded: boolean
  /** Per-collection doc counts (from getSeedStatus) — rendered inline when seeded. */
  counts?: Record<string, number>
  /** Muted caveat line inside the panel (e.g. mux's credentials note). */
  note?: ReactNode
}
