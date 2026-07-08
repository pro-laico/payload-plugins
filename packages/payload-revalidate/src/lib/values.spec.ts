import { describe, expect, it } from 'vitest'
import { docRecord, isId, isPlainObject } from './values'

describe('isId', () => {
  it('accepts strings and numbers only', () => {
    expect(isId('abc')).toBe(true)
    expect(isId(42)).toBe(true)
    expect(isId(0)).toBe(true)
    expect(isId('')).toBe(true)
    for (const value of [null, undefined, {}, [], true, { id: 1 }]) expect(isId(value)).toBe(false)
  })
})

describe('isPlainObject', () => {
  it('accepts non-array objects only', () => {
    expect(isPlainObject({})).toBe(true)
    expect(isPlainObject({ a: 1 })).toBe(true)
    for (const value of [null, undefined, [], 'x', 5, true]) expect(isPlainObject(value)).toBe(false)
  })
})

describe('docRecord', () => {
  it('passes a record through and coerces anything else to {}', () => {
    const doc = { id: 1, slug: 'x' }
    expect(docRecord(doc)).toBe(doc)
    for (const value of [null, undefined, [], 'x', 5]) expect(docRecord(value)).toEqual({})
  })
})
