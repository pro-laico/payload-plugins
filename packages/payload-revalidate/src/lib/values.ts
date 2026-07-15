export const isId = (value: unknown): value is string | number => typeof value === 'string' || typeof value === 'number'

export const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const docRecord = (doc: unknown): Record<string, unknown> => (isPlainObject(doc) ? doc : {})

export const docId = (doc: unknown): string | number | undefined => (isPlainObject(doc) && isId(doc.id) ? doc.id : undefined)
