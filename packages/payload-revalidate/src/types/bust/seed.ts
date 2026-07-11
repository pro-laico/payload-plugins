/** The slice of payload-seed's `SeedResult` this listener reads (structural — no import). */
export interface SeedResultLike {
  /** Docs created per collection slug. */
  created: Record<string, number>
  /** Collection slugs the run touched (cleared even when zero records were created). */
  collections?: string[]
  /** Global slugs the run seeded. */
  globals?: string[]
}
