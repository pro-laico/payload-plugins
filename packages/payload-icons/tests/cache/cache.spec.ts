import type { Payload } from 'payload'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const tagged: string[][] = []
vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({
  cacheTag: (...tags: string[]) => {
    tagged.push(tags)
  },
}))

const { getIconSvg } = await import('../../src/cache')

type FindArgs = { collection: string; draft?: boolean; where?: Record<string, unknown> }

const calls: FindArgs[] = []

type FakeOptions = { rows?: unknown[]; drafts?: boolean }

const fakePayload = ({ rows = [{ name: 'cart', icon: { svgString: '<svg>CART</svg>' } }], drafts = false }: FakeOptions = {}): Payload =>
  ({
    config: { custom: { payloadIcons: { iconSetSlug: 'iconSet' } } },
    collections: { iconSet: { config: { versions: { drafts } } } },
    find: async (args: FindArgs) => {
      calls.push(args)
      return { docs: [{ iconsArray: rows }] }
    },
  }) as unknown as Payload

beforeEach(() => {
  calls.length = 0
  tagged.length = 0
})

describe('getIconSvg', () => {
  it('resolves a name from the active set', async () => {
    expect(await getIconSvg(fakePayload(), 'cart')).toBe('<svg>CART</svg>')
    expect(await getIconSvg(fakePayload(), 'ghost')).toBeUndefined()
  })

  // The bug this file exists for: cacheTag used to run in the caller, outside any cache scope, so
  // the entry materialized untagged — nothing could ever bust an icon read.
  it('tags the read with the tag the icon collections declare', async () => {
    await getIconSvg(fakePayload(), 'cart')
    expect(tagged).toContainEqual(['payload-icons'])
  })

  // Lanes follow payload-revalidate: a published write busts the plain tag, a draft-only write
  // busts `:draft`. The draft read has to claim both or publishing leaves it stale.
  it('claims both lanes when reading drafts, and only the published lane otherwise', async () => {
    await getIconSvg(fakePayload(), 'cart', true)
    expect(tagged).toContainEqual(['payload-icons', 'payload-icons:draft'])

    tagged.length = 0
    await getIconSvg(fakePayload(), 'cart', false)
    expect(tagged).toContainEqual(['payload-icons'])
    expect(tagged.flat()).not.toContain('payload-icons:draft')
  })

  it('filters to the published lane only when the collection has drafts enabled', async () => {
    await getIconSvg(fakePayload({ drafts: true }), 'cart')
    expect(calls[0]?.where).toEqual({ and: [{ active: { equals: true } }, { _status: { equals: 'published' } }] })

    calls.length = 0
    await getIconSvg(fakePayload({ drafts: false }), 'cart')
    expect(calls[0]?.where).toEqual({ active: { equals: true } })

    calls.length = 0
    await getIconSvg(fakePayload({ drafts: true }), 'cart', true)
    expect(calls[0]).toMatchObject({ draft: true, where: { active: { equals: true } } })
  })

  it('skips rows without a name or an svg rather than emitting empty icons', async () => {
    const rows = [{ name: 'ok', icon: { svgString: '<svg/>' } }, { name: 'no-svg', icon: {} }, { icon: { svgString: '<svg/>' } }, null]
    const payload = fakePayload({ rows })
    expect(await getIconSvg(payload, 'ok')).toBe('<svg/>')
    expect(await getIconSvg(payload, 'no-svg')).toBeUndefined()
  })
})
