/** What a location's privacy law asks of you before non-essential cookies or trackers run.
 *
 * - `opt-in` — nothing non-essential until the visitor says yes (GDPR-style)
 * - `opt-out` — it may run, but you owe a visible way to turn it off (CCPA-style)
 * - `none` — no comprehensive law worth branching on */
export type ConsentModel = 'opt-in' | 'opt-out' | 'none'

/** The regime a region falls under. `none` means "nothing here changes what you render". */
export type PrivacyRegime = 'gdpr' | 'uk-gdpr' | 'ccpa' | 'lgpd' | 'pipeda' | 'fadp' | 'appi' | 'pipl' | 'none'

/** One place you can pretend to be. `code` is ISO 3166 — `'DE'`, or `'US-CA'` for a subdivision
 * with a law of its own. */
export interface DevRegion {
  code: string
  label: string
  regime: PrivacyRegime
  consent: ConsentModel
}

/** `resolveDevRegion`'s argument. `region` is the real location your app worked out (a geo header,
 * usually); the override only ever replaces it in development. */
export interface ResolveDevRegionOptions {
  region?: string | null
  regions?: DevRegion[]
  enabled?: boolean
}
