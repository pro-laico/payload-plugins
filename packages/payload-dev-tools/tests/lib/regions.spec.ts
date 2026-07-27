import { describe, expect, it } from 'vitest'
import { DEFAULT_REGIONS, REGIONS, regionFor } from '../../src/lib/regions'
import type { DevRegion } from '../../src/types'

describe('regionFor', () => {
  it('resolves every EEA country to GDPR / opt-in, not just the chip list', () => {
    expect(regionFor('NL')).toEqual({ code: 'NL', label: 'Netherlands', regime: 'gdpr', consent: 'opt-in' })
    expect(regionFor('DE')?.regime).toBe('gdpr')
    expect(REGIONS.filter((r) => r.regime === 'gdpr')).toHaveLength(30)
  })

  it('normalizes case and the underscore form of a subdivision code', () => {
    for (const code of ['US-CA', 'us-ca', ' us_ca ']) expect(regionFor(code)?.label).toBe('California')
  })

  it('separates the country from its subdivision (US has no federal regime, California does)', () => {
    expect(regionFor('US')).toMatchObject({ regime: 'none', consent: 'none' })
    expect(regionFor('US-CA')).toMatchObject({ regime: 'ccpa', consent: 'opt-out' })
  })

  it('returns undefined for nothing and for an unknown code — the caller decides what that means', () => {
    for (const code of [undefined, null, '', 'XX']) expect(regionFor(code)).toBeUndefined()
  })

  it('lets a configured region override the built-in table', () => {
    const regions: DevRegion[] = [{ code: 'US', label: 'United States', regime: 'ccpa', consent: 'opt-out' }]
    expect(regionFor('US', regions)?.regime).toBe('ccpa')
    expect(regionFor('DE', regions)?.regime).toBe('gdpr')
  })

  it('offers one default chip per distinct behaviour', () => {
    expect(DEFAULT_REGIONS.map((r) => r.code)).toEqual(['DE', 'FR', 'GB', 'CH', 'US', 'US-CA', 'BR', 'CA', 'JP'])
    expect(new Set(DEFAULT_REGIONS.map((r) => r.regime)).size).toBe(8)
  })
})
