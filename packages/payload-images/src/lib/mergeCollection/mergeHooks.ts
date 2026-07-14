import { isRecord } from '../isRecord'

export const mergeHooks = <T>(base: T, extra?: T): T => {
  if (!extra) return base
  const b: Record<string, unknown> = isRecord(base) ? base : {}
  const e: Record<string, unknown> = isRecord(extra) ? extra : {}
  const out: Record<string, unknown> = { ...b }
  for (const key of Object.keys(e)) {
    const bv = Array.isArray(b[key]) ? b[key] : []
    const ev = Array.isArray(e[key]) ? e[key] : []
    out[key] = [...bv, ...ev]
  }
  //EXCUSE: merges the hook-array object generically; TS can't prove the rebuilt Record matches the caller's generic T
  return out as unknown as T
}
