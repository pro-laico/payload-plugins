import { beforeEach, describe, expect, it, vi } from 'vitest'

const jar = new Map<string, string>()
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (jar.has(name) ? { value: jar.get(name) } : undefined) }),
}))

const { resolveDevRegion } = await import('../../src/components/resolveDevRegion')

beforeEach(() => jar.clear())

describe('resolveDevRegion', () => {
  it('returns the real region when disabled (production default under NODE_ENV=test)', async () => {
    jar.set('pdt-region', 'DE')
    expect(await resolveDevRegion({ region: 'US' })).toMatchObject({ code: 'US' })
  })

  it('returns the real region in development while no override is set', async () => {
    expect(await resolveDevRegion({ region: 'US', enabled: true })).toMatchObject({ code: 'US', consent: 'none' })
  })

  it('substitutes the overridden region in development', async () => {
    jar.set('pdt-region', 'DE')
    expect(await resolveDevRegion({ region: 'US', enabled: true })).toMatchObject({ code: 'DE', regime: 'gdpr', consent: 'opt-in' })
  })

  it('falls back to the real region when the cookie holds an unknown code', async () => {
    jar.set('pdt-region', 'XX')
    expect(await resolveDevRegion({ region: 'GB', enabled: true })).toMatchObject({ code: 'GB' })
  })

  it('resolves to undefined when neither the override nor the real region is known', async () => {
    expect(await resolveDevRegion({ region: null, enabled: true })).toBeUndefined()
  })

  it('resolves an override against the configured regions', async () => {
    jar.set('pdt-region', 'NZ')
    const regions = [{ code: 'NZ', label: 'New Zealand', regime: 'none', consent: 'opt-out' } as const]
    expect(await resolveDevRegion({ region: 'US', regions: [...regions], enabled: true })).toMatchObject({ code: 'NZ', consent: 'opt-out' })
  })
})
