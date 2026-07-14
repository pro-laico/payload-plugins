export const seedingEnabled = (): boolean => process.env.ENABLE_SEED === 'true'

export const SEED_DISABLED_MESSAGE = 'Seeding is disabled. Set ENABLE_SEED=true to enable it (DESTRUCTIVE: wipes the seeded collections).'
