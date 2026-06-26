/**
 * Master kill switch for the destructive seed. Both run paths — a CLI runner and the
 * in-app `POST /api/seed` endpoint — refuse to run unless `ENABLE_SEED` is exactly
 * `"true"`. The seed WIPES whole collections, so it stays off by default: opt in
 * per-environment by setting `ENABLE_SEED=true` while iterating, and never set it in
 * production. The gate lives only on the entry points, never inside the engine, so an
 * integration test can drive the real seed directly.
 */
export const seedingEnabled = (): boolean => process.env.ENABLE_SEED === 'true'

export const SEED_DISABLED_MESSAGE = 'Seeding is disabled. Set ENABLE_SEED=true to enable it (DESTRUCTIVE: wipes the seeded collections).'
