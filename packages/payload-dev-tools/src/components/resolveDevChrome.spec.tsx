import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineTest } from '../harness'

const jar = new Map<string, string>()
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (jar.has(name) ? { value: jar.get(name) } : undefined) }),
}))

const { resolveDevChrome } = await import('./resolveDevChrome')

const headerTest = defineTest({
  key: 'site-header',
  label: 'Site header',
  kind: 'header',
  versions: [
    { id: 'centered', label: 'Centered', render: () => 'CENTERED-HEADER' },
    { id: 'boom', label: 'Boom', render: () => Promise.reject(new Error('variant exploded')) },
  ],
})
const pageTest = defineTest({ key: 'hero', label: 'Hero', kind: 'page', versions: [{ id: 'a', label: 'A', render: () => 'HERO-A' }] })
const tests = [headerTest, pageTest]

beforeEach(() => jar.clear())

describe('resolveDevChrome', () => {
  it('returns the real chrome untouched when disabled (production default under NODE_ENV=test)', async () => {
    jar.set('pdt-chrome-header', 'site-header:centered')
    const out = await resolveDevChrome({ tests, header: 'REAL-H', footer: 'REAL-F' })
    expect(out).toEqual({ header: 'REAL-H', footer: 'REAL-F' })
  })

  it('swaps the selected header variant in, leaving the footer real', async () => {
    jar.set('pdt-chrome-header', 'site-header:centered')
    const out = await resolveDevChrome({ tests, header: 'REAL-H', footer: 'REAL-F', enabled: true })
    expect(out).toEqual({ header: 'CENTERED-HEADER', footer: 'REAL-F' })
  })

  it('ignores stale cookies, cross-kind keys, and unknown versions', async () => {
    jar.set('pdt-chrome-header', 'hero:a') // a page test can never occupy a chrome slot
    jar.set('pdt-chrome-footer', 'site-header:ghost')
    const out = await resolveDevChrome({ tests, header: 'REAL-H', footer: 'REAL-F', enabled: true })
    expect(out).toEqual({ header: 'REAL-H', footer: 'REAL-F' })
  })

  it('falls back to the real chrome when a variant throws — never takes the site down', async () => {
    jar.set('pdt-chrome-header', 'site-header:boom')
    const out = await resolveDevChrome({ tests, header: 'REAL-H', footer: 'REAL-F', enabled: true })
    expect(out.header).toBe('REAL-H')
  })
})
