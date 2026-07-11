import { describe, expect, it } from 'vitest'
import { defineTest, parseStage, toTestMeta } from '../src/harness'

const hero = defineTest({
  key: 'hero',
  label: 'Home hero',
  kind: 'page',
  versions: [
    { id: 'bold', label: 'Bold', render: () => null },
    { id: 'split', label: 'Split', render: () => null },
  ],
})

describe('defineTest / toTestMeta', () => {
  it('defineTest is an identity helper', () => {
    expect(defineTest(hero)).toBe(hero)
  })

  it('toTestMeta strips render fns (client-safe)', () => {
    const meta = toTestMeta([hero])
    expect(meta).toEqual([
      {
        key: 'hero',
        label: 'Home hero',
        kind: 'page',
        versions: [
          { id: 'bold', label: 'Bold' },
          { id: 'split', label: 'Split' },
        ],
      },
    ])
    expect(JSON.stringify(meta)).not.toContain('render')
  })
})

describe('parseStage', () => {
  it('resolves a valid testKey:versionId cookie', () => {
    const stage = parseStage('hero:bold', [hero])
    expect(stage?.test.key).toBe('hero')
    expect(stage?.version.id).toBe('bold')
  })

  it('decodes URI-encoded cookie values', () => {
    expect(parseStage(encodeURIComponent('hero:split'), [hero])?.version.id).toBe('split')
  })

  it('returns null for unknown tests, unknown versions, and malformed values', () => {
    expect(parseStage('ghost:bold', [hero])).toBeNull()
    expect(parseStage('hero:ghost', [hero])).toBeNull()
    expect(parseStage('no-separator', [hero])).toBeNull()
    expect(parseStage(':bold', [hero])).toBeNull()
    expect(parseStage(undefined, [hero])).toBeNull()
    expect(parseStage('%E0%A4%A-malformed', [hero])).toBeNull()
  })
})
