import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTags } from '../../../src/lib/tags'
import { createGlobalAfterChange } from '../../../src/hooks/global/afterChange'

const bust = vi.fn()
vi.mock('../../../src/lib/bust', () => ({ bust: (...args: unknown[]) => bust(...args) }))

const bustedTags = (): string[] => (bust.mock.calls[0]?.[0] as { tag: string }[]).map((b) => b.tag)
const hook = (slug: string) => createGlobalAfterChange(slug, { tags: createTags(), observe: false })

describe('createGlobalAfterChange', () => {
  beforeEach(() => bust.mockReset())

  it('busts both lanes on a published save', async () => {
    await hook('header')({ doc: { _status: 'published' }, req: { context: {} } } as never)
    expect(bustedTags().sort()).toEqual(['global:header', 'global:header:draft'].sort())
  })

  it('busts only the draft lane on a draft save', async () => {
    await hook('header')({ doc: { _status: 'draft' }, previousDoc: { _status: 'draft' }, req: { context: {} } } as never)
    expect(bustedTags()).toEqual(['global:header:draft'])
  })

  it('busts both lanes for globals without drafts and honors disableRevalidate', async () => {
    await hook('header')({ doc: { title: 'x' }, req: { context: {} } } as never)
    expect(bustedTags()).toContain('global:header')
    bust.mockReset()
    await hook('header')({ doc: {}, req: { context: { disableRevalidate: true } } } as never)
    expect(bust).not.toHaveBeenCalled()
  })
})
