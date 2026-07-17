import { isRecord } from '../../../_kit'

// REST responses are external data — narrow them at the boundary into the panel's own view types.

const num = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined)
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)

// ——— variants (the generated cache, folded into the same table) ———
export type VariantRow = {
  id: string | number
  filename?: string
  width?: number
  height?: number
  fit?: string
  quality?: number
  format?: string
}
export type VariantPage = { docs: VariantRow[]; totalDocs: number; totalPages: number }

export const parseVariantPage = (raw: unknown): VariantPage | null => {
  if (!isRecord(raw) || !Array.isArray(raw.docs)) return null
  const docs = raw.docs.flatMap((d: unknown): VariantRow[] => {
    if (!isRecord(d)) return []
    const id = typeof d.id === 'string' || typeof d.id === 'number' ? d.id : null
    if (id == null) return []
    return [
      {
        id,
        filename: str(d.filename),
        width: num(d.width),
        height: num(d.height),
        fit: str(d.fit),
        quality: num(d.quality),
        format: str(d.format),
      },
    ]
  })
  return { docs, totalDocs: num(raw.totalDocs) ?? docs.length, totalPages: num(raw.totalPages) ?? 1 }
}

// ——— preset ↔ cached-variant matches (server computes the cacheKeys; the panel just displays) ———
export type PresetMatch = { variantId?: string | number; filename?: string }

export const parsePresetMatches = (raw: unknown): Map<string, PresetMatch> | null => {
  if (!isRecord(raw) || !Array.isArray(raw.presets)) return null
  const out = new Map<string, PresetMatch>()
  for (const item of raw.presets) {
    if (!isRecord(item) || typeof item.name !== 'string') continue
    const variantId = typeof item.variantId === 'string' || typeof item.variantId === 'number' ? item.variantId : undefined
    out.set(item.name, { variantId, ...(typeof item.filename === 'string' ? { filename: item.filename } : {}) })
  }
  return out
}

// ——— prewarm status (queued/running job + planned targets) ———
export type PlanRow = { cacheKey: string; w?: number; h?: number; fit?: string; quality?: number; format?: string }
export type PrewarmView = {
  status: 'idle' | 'queued' | 'running'
  plan: PlanRow[]
  waitUntil?: string
  lastRun?: { generated?: number; failed?: number; skipped?: string }
}

export const parsePrewarmStatus = (raw: unknown): PrewarmView | null => {
  if (!isRecord(raw) || !('status' in raw)) return null
  const status = raw.status === 'queued' || raw.status === 'running' ? raw.status : 'idle'
  const plan = (Array.isArray(raw.plan) ? raw.plan : []).flatMap((item: unknown): PlanRow[] => {
    if (!isRecord(item)) return []
    const cacheKey = str(item.cacheKey)
    if (!cacheKey) return []
    const params = isRecord(item.params) ? item.params : {}
    return [{ cacheKey, w: num(params.w), h: num(params.h), fit: str(params.fit), quality: num(params.q), format: str(item.format) }]
  })
  const job = isRecord(raw.job) ? raw.job : null
  const lastRun = isRecord(raw.lastRun) ? raw.lastRun : null
  return {
    status,
    plan,
    ...(job && typeof job.waitUntil === 'string' ? { waitUntil: job.waitUntil } : {}),
    ...(lastRun ? { lastRun: { generated: num(lastRun.generated), failed: num(lastRun.failed), skipped: str(lastRun.skipped) } } : {}),
  }
}
