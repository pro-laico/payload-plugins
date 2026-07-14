const errorCode = (e: unknown): unknown => (typeof e === 'object' && e !== null && 'code' in e ? e.code : undefined)
const errorCause = (e: unknown): unknown => (typeof e === 'object' && e !== null && 'cause' in e ? e.cause : undefined)

export const isDuplicateKeyError = (err: unknown, uniqueField = 'cacheKey'): boolean => {
  let e: unknown = err
  for (let depth = 0; depth < 4 && e; depth++) {
    const msg = e instanceof Error ? e.message : String(e)
    const code = errorCode(e)
    if (/duplicate|unique/i.test(`${msg} ${typeof code === 'string' ? code : ''}`)) return true
    e = errorCause(e)
  }
  const data = typeof err === 'object' && err !== null && 'data' in err ? err.data : undefined
  const fieldErrors = typeof data === 'object' && data !== null && 'errors' in data ? data.errors : undefined
  if (!Array.isArray(fieldErrors)) return false
  return fieldErrors.some((f: unknown) => {
    if (typeof f !== 'object' || f === null) return false
    if ('path' in f && f.path === uniqueField) return true
    return 'message' in f && typeof f.message === 'string' && /unique/i.test(f.message)
  })
}

export const isForeignKeyError = (err: unknown): boolean => {
  let e: unknown = err
  for (let depth = 0; depth < 4 && e; depth++) {
    const msg = e instanceof Error ? e.message : String(e)
    const code = errorCode(e)
    if (/foreign key/i.test(msg) || /FOREIGNKEY|23503|ER_NO_REFERENCED_ROW/.test(`${typeof code === 'string' ? code : ''}`)) return true
    e = errorCause(e)
  }
  return false
}
