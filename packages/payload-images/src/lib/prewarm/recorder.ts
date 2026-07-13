/**
 * The prewarm observation recorder — the transform endpoint's write path into the render-profile
 * registry, built so the serving path never pays for it: `observe()` is pure in-memory map work
 * (never awaits, never throws), and a single unref'd timer flushes the buffer to the collection.
 * Steady-state hit counting is throttled (≤4 writes/hour/profile/process); NEW information — a
 * profile or width not yet persisted — flushes within one interval.
 */
import type { Payload } from 'payload'
import { asSlug } from '../asSlug'

import { isDuplicateKeyError } from '../errors'
import { canonicalProfileKey, type RatioCandidate, ratioToken } from './profileKey'
import type { ProfileParts, RenderProfileDoc, WidthHistogram } from '../../types'

/** Buffer→DB flush interval; overridable for tests via IMAGES_PREWARM_FLUSH_MS. */
const FLUSH_MS = Number(process.env.IMAGES_PREWARM_FLUSH_MS) || 30_000
const HIT_FLUSH_MS = 15 * 60_000
const RATIO_REFRESH_MS = 5 * 60_000
const MAX_BUFFERED_PROFILES = 128
const MAX_WIDTH_ENTRIES = 24

interface BufferEntry {
  parts: ProfileParts
  hits: number
  widths: Map<number, number>
  /** Widths already persisted for this profile (this process) — a width outside it is "new". */
  persistedWidths: Set<number>
  lastFlushedAt?: number
}

export interface ObservationRecorder {
  /** O(1), synchronous, never throws — safe on the serving path. */
  observe(o: { parts: ProfileParts; width?: number }): void
  /** Declared-ratio candidates for classification: seeds first, then learned (buffer + DB). */
  knownRatios(): RatioCandidate[]
  /** Drain the buffer to the collection immediately (tests / CLI). */
  flushNow(): Promise<void>
}

export const createObservationRecorder = (deps: {
  payload: Payload
  profilesSlug: string
  seedCandidates: RatioCandidate[]
}): ObservationRecorder => {
  const { payload, seedCandidates } = deps
  const slug = asSlug(deps.profilesSlug)
  const buffer = new Map<string, BufferEntry>()
  let timer: ReturnType<typeof setTimeout> | undefined
  let warnedBufferCap = false
  let warnedFlush = false
  let dbRatios: RatioCandidate[] = []
  let dbRatiosLoadedAt = 0
  let dbRatiosLoading = false

  const refreshDbRatios = (): void => {
    if (dbRatiosLoading || Date.now() - dbRatiosLoadedAt < RATIO_REFRESH_MS) return
    dbRatiosLoading = true
    void payload
      //EXCUSE: the select targets a runtime-configured collection an app's generated types may not know
      .find({ collection: slug, limit: 100, depth: 0, select: { ratio: true } as never })
      .then((res) => {
        dbRatios = res.docs.flatMap((doc) => {
          const ratio = Number((doc as { ratio?: string }).ratio) //EXCUSE: docs of a runtime-configured collection are untyped; NaN-guarded below
          return Number.isFinite(ratio) && ratio > 0 ? [{ token: ratioToken(ratio), ratio }] : []
        })
        dbRatiosLoadedAt = Date.now()
      })
      .catch(() => undefined)
      .finally(() => {
        dbRatiosLoading = false
      })
  }

  const flushEntry = async (key: string, entry: BufferEntry): Promise<void> => {
    const now = Date.now()
    const newWidths = [...entry.widths.keys()].filter((w) => !entry.persistedWidths.has(w))
    const due = entry.lastFlushedAt == null || now - entry.lastFlushedAt >= HIT_FLUSH_MS
    if (!newWidths.length && !due) return
    if (!entry.hits && !newWidths.length) return

    const nowIso = new Date(now).toISOString()
    const mergeWidths = (existing: WidthHistogram | null | undefined): WidthHistogram => {
      const merged: WidthHistogram = { ...(existing ?? {}) }
      for (const [w, n] of entry.widths) {
        const prev = merged[String(w)]
        merged[String(w)] = { n: (prev?.n ?? 0) + n, last: nowIso }
      }
      const keys = Object.keys(merged)
      if (keys.length > MAX_WIDTH_ENTRIES) {
        keys
          .sort((a, b) => (merged[a]?.n ?? 0) - (merged[b]?.n ?? 0))
          .slice(0, keys.length - MAX_WIDTH_ENTRIES)
          .forEach((k) => delete merged[k])
      }
      return merged
    }

    const update = async (): Promise<boolean> => {
      const found = await payload.find({ collection: slug, where: { profileKey: { equals: key } }, limit: 1, depth: 0 })
      const existing = found.docs[0] as unknown as RenderProfileDoc | undefined //EXCUSE: docs of a runtime-configured collection are untyped; fields are null-guarded
      if (!existing) return false
      await payload.update({
        collection: slug,
        id: existing.id,
        data: { hitCount: (existing.hitCount ?? 0) + entry.hits, lastSeenAt: nowIso, widths: mergeWidths(existing.widths) } as never, //EXCUSE: data for a runtime-configured collection can't satisfy the generated per-collection data type
      })
      return true
    }

    if (!(await update())) {
      try {
        await payload.create({
          collection: slug,
          data: {
            profileKey: key,
            ratio: entry.parts.ratio,
            fit: entry.parts.fit,
            quality: entry.parts.quality,
            format: entry.parts.format,
            hitCount: entry.hits,
            lastSeenAt: nowIso,
            widths: mergeWidths(null),
          } as never, //EXCUSE: data for a runtime-configured collection can't satisfy the generated per-collection data type
        })
      } catch (err) {
        if (!isDuplicateKeyError(err, 'profileKey')) throw err
        await update() // another process created it between the find and the create
      }
    }

    entry.hits = 0
    for (const w of entry.widths.keys()) entry.persistedWidths.add(w)
    entry.widths.clear()
    entry.lastFlushedAt = now
  }

  const flush = async (): Promise<void> => {
    timer = undefined
    for (const [key, entry] of buffer) {
      try {
        await flushEntry(key, entry)
      } catch (err) {
        if (!warnedFlush) {
          warnedFlush = true
          payload.logger.warn(`[payload-images] prewarm: failed to record render profiles (warns once per process): ${String(err)}`)
        }
      }
    }
  }

  return {
    observe: ({ parts, width }) => {
      const key = canonicalProfileKey(parts)
      let entry = buffer.get(key)
      if (!entry) {
        if (buffer.size >= MAX_BUFFERED_PROFILES) {
          if (!warnedBufferCap) {
            warnedBufferCap = true
            payload.logger.warn('[payload-images] prewarm: observation buffer full — new render profiles are being dropped this process.')
          }
          return
        }
        entry = { parts, hits: 0, widths: new Map(), persistedWidths: new Set() }
        buffer.set(key, entry)
      }
      entry.hits++
      if (width != null && width > 0) entry.widths.set(width, (entry.widths.get(width) ?? 0) + 1)
      if (!timer) {
        timer = setTimeout(() => void flush(), FLUSH_MS)
        timer.unref?.()
      }
      refreshDbRatios()
    },
    knownRatios: () => {
      const seen = new Set(seedCandidates.map((c) => c.token))
      const learned: RatioCandidate[] = []
      for (const entry of buffer.values()) {
        const ratio = Number(entry.parts.ratio)
        if (Number.isFinite(ratio) && ratio > 0 && !seen.has(entry.parts.ratio)) {
          seen.add(entry.parts.ratio)
          learned.push({ token: entry.parts.ratio, ratio })
        }
      }
      for (const c of dbRatios) {
        if (!seen.has(c.token)) {
          seen.add(c.token)
          learned.push(c)
        }
      }
      return [...seedCandidates, ...learned]
    },
    flushNow: async () => {
      if (timer) {
        clearTimeout(timer)
        timer = undefined
      }
      await flush()
    },
  }
}
