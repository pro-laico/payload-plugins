import { isRecord } from '../_kit'

export const refId = (ref: unknown): string | number | undefined => {
  if (isRecord(ref)) return typeof ref.id === 'string' || typeof ref.id === 'number' ? ref.id : undefined
  return typeof ref === 'string' || typeof ref === 'number' ? ref : undefined
}
