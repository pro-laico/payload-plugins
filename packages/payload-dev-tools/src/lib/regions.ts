import type { DevRegion } from '../types'

// The EEA, where the answer is always the same: GDPR, opt-in. Listed out (rather than collapsed to
// an `EU` pseudo-region) so a real `x-vercel-ip-country` of `NL` resolves as itself.
const EEA: Record<string, string> = {
  AT: 'Austria',
  BE: 'Belgium',
  BG: 'Bulgaria',
  HR: 'Croatia',
  CY: 'Cyprus',
  CZ: 'Czechia',
  DK: 'Denmark',
  EE: 'Estonia',
  FI: 'Finland',
  FR: 'France',
  DE: 'Germany',
  GR: 'Greece',
  HU: 'Hungary',
  IE: 'Ireland',
  IS: 'Iceland',
  IT: 'Italy',
  LI: 'Liechtenstein',
  LT: 'Lithuania',
  LU: 'Luxembourg',
  LV: 'Latvia',
  MT: 'Malta',
  NL: 'Netherlands',
  NO: 'Norway',
  PL: 'Poland',
  PT: 'Portugal',
  RO: 'Romania',
  SE: 'Sweden',
  SI: 'Slovenia',
  SK: 'Slovakia',
  ES: 'Spain',
}

const REST: DevRegion[] = [
  { code: 'GB', label: 'United Kingdom', regime: 'uk-gdpr', consent: 'opt-in' },
  { code: 'CH', label: 'Switzerland', regime: 'fadp', consent: 'opt-out' },
  { code: 'BR', label: 'Brazil', regime: 'lgpd', consent: 'opt-in' },
  { code: 'CA', label: 'Canada', regime: 'pipeda', consent: 'opt-out' },
  { code: 'JP', label: 'Japan', regime: 'appi', consent: 'opt-out' },
  { code: 'CN', label: 'China', regime: 'pipl', consent: 'opt-in' },
  { code: 'US-CA', label: 'California', regime: 'ccpa', consent: 'opt-out' },
  { code: 'US', label: 'United States', regime: 'none', consent: 'none' },
]

/** Every region this plugin can resolve — the EEA plus the countries that run their own regime. */
export const REGIONS: DevRegion[] = [
  ...Object.entries(EEA).map(([code, label]): DevRegion => ({ code, label, regime: 'gdpr', consent: 'opt-in' })),
  ...REST,
]

const BY_CODE = new Map(REGIONS.map((r) => [r.code, r]))
const normalize = (code: string): string => code.trim().toUpperCase().replace('_', '-')

/** The default toolbar chips: one region per behaviour worth eyeballing, not the whole table. */
export const DEFAULT_REGIONS: DevRegion[] = ['DE', 'FR', 'GB', 'CH', 'US', 'US-CA', 'BR', 'CA', 'JP'].flatMap((code) => {
  const region = BY_CODE.get(code)
  return region ? [region] : []
})

/** Resolve a country (or subdivision) code to its regime. `regions` — the plugin's configured list —
 * wins over the built-in table, so an app can correct or extend an entry without a fork. */
export const regionFor = (code: string | null | undefined, regions: DevRegion[] = []): DevRegion | undefined => {
  if (!code) return undefined
  const normalized = normalize(code)
  return regions.find((r) => normalize(r.code) === normalized) ?? BY_CODE.get(normalized)
}
