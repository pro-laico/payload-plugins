import { APIError } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import { makeRejectSharedOriginals } from '../../src/hooks/collection/rejectSharedOriginals'

type FindArgs = { collection: string; where: unknown; limit?: number; pagination?: boolean; depth?: number; req?: unknown }

const hookWith = (docs: Record<string, unknown>[]) => {
  const find = vi.fn(async (args: FindArgs) => ({ docs, totalDocs: docs.length, ...args }))
  const req = { payload: { find } }
  const run = (data: Record<string, unknown>, originalDoc?: Record<string, unknown>) =>
    makeRejectSharedOriginals('font')({ data, originalDoc, req, collection: { slug: 'font' }, context: {}, operation: 'create' } as never)
  return { find, run }
}

const sharing = { weights: [{ file: 'orig-1' }] }

describe('makeRejectSharedOriginals', () => {
  it('runs its lookup unpaginated', async () => {
    // A paginated find issues its count and its query concurrently on one Mongo session. This is a
    // beforeValidate hook, so it is the transaction's first command and the two race
    // startTransaction — one arrives without it and is rejected (NoSuchTransaction), which aborts
    // the whole transaction and makes creating a font fail. Only a live replica set reproduces the
    // race, so this asserts the flag that prevents it.
    const { find, run } = hookWith([])
    await run(sharing)
    expect(find).toHaveBeenCalledOnce()
    expect(find.mock.calls[0]?.[0]).toMatchObject({ collection: 'font', pagination: false })
  })

  it('rejects an original already used by another typeface, naming it', async () => {
    const { run } = hookWith([{ id: 2, title: 'Abril' }])
    await expect(run(sharing)).rejects.toThrow(APIError)
    await expect(run(sharing)).rejects.toThrow(/already used by Abril/)
  })

  it('passes when no other typeface references the original', async () => {
    const { run } = hookWith([])
    await expect(run(sharing)).resolves.toEqual(sharing)
  })

  it('excludes the document itself so re-saving a typeface is not a conflict', async () => {
    const { find, run } = hookWith([])
    await run(sharing, { id: 9 })
    expect(find.mock.calls[0]?.[0].where).toMatchObject({ and: [{ id: { not_equals: 9 } }, expect.anything()] })
  })

  it('skips the lookup entirely when the document references no originals', async () => {
    const { find, run } = hookWith([])
    await expect(run({ title: 'Inter' })).resolves.toEqual({ title: 'Inter' })
    expect(find).not.toHaveBeenCalled()
  })
})
