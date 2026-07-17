import type { Payload } from 'payload'

import { asSlug, isRecord } from '../../_kit'
import { isDuplicateKeyError } from '../errors'
import type { ProfileParts, RenderProfileDoc, WidthHistogram } from '../../types'
import { canonicalProfileKey, type RatioCandidate, ratioToken } from './profileKey'

const isRenderProfileDoc = (v: unknown): v is RenderProfileDoc => isRecord(v) && (typeof v.id === 'string' || typeof v.id === 'number')

const FLUSH_MS = Number(process.env.IMAGES_PREWARM_FLUSH_MS) || 30_000
const HIT_FLUSH_MS = 15 * 60_000
const RATIO_REFRESH_MS = 5 * 60_000
const MAX_BUFFERED_PROFILES = 128
const MAX_WIDTH_ENTRIES = 24

interface BufferEntry {
  parts: ProfileParts
  hits: number
  widths: Map<number, number>
  persistedWidths: Set<number>
  lastFlushedAt?: number
}

export interface ObservationRecorder {
  observe(o: { parts: ProfileParts; width?: number }): void
  knownRatios(): RatioCandidate[]
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
      .find({ collection: slug, limit: 100, depth: 0, select: { ratio: true } })
      .then((res) => {
        dbRatios = res.docs.flatMap((doc) => {
          const ratio = Number(isRecord(doc) ? doc.ratio : undefined)
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

    // Snapshot-and-swap BEFORE any await: observations landing during the DB round-trip go to the
    // fresh buffers instead of being zeroed, and only what was actually written marks persisted.
    const hits = entry.hits
    const widths = entry.widths
    entry.hits = 0
    entry.widths = new Map()

    const nowIso = new Date(now).toISOString()
    const mergeWidths = (existing: WidthHistogram | null | undefined): WidthHistogram => {
      const merged: WidthHistogram = { ...(existing ?? {}) }
      for (const [w, n] of widths) {
        const prev = merged[String(w)]
        merged[String(w)] = { n: (prev?.n ?? 0) + n, last: nowIso }
      }
      const keys = Object.keys(merged)
      if (keys.length > MAX_WIDTH_ENTRIES) {
        keys
          .sort((a, b) => (merged[a]?.n ?? 0) - (merged[b]?.n ?? 0))
          .slice(0, keys.length - MAX_WIDTH_ENTRIES)
          .forEach((k) => {
            delete merged[k]
          })
      }
      return merged
    }

    const update = async (): Promise<boolean> => {
      const found = await payload.find({ collection: slug, where: { profileKey: { equals: key } }, limit: 1, depth: 0 })
      const existing = found.docs.find(isRenderProfileDoc)
      if (!existing) return false
      await payload.update({
        collection: slug,
        id: existing.id,
        data: { hitCount: (existing.hitCount ?? 0) + hits, lastSeenAt: nowIso, widths: mergeWidths(existing.widths) },
      })
      return true
    }

    try {
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
              hitCount: hits,
              lastSeenAt: nowIso,
              widths: mergeWidths(null),
            },
          })
        } catch (err) {
          if (!isDuplicateKeyError(err, 'profileKey')) throw err
          await update()
        }
      }
    } catch (err) {
      // Write failed: merge the snapshot back so the observations retry on a later flush.
      entry.hits += hits
      for (const [w, n] of widths) entry.widths.set(w, (entry.widths.get(w) ?? 0) + n)
      throw err
    }

    for (const w of widths.keys()) entry.persistedWidths.add(w)
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

  // Flush passes never overlap (a concurrent pass would double-count via the find-then-update
  // read-modify-write); a trigger landing mid-pass queues exactly one follow-up pass.
  let flushing: Promise<void> | undefined
  let rerun = false
  const runFlush = (): Promise<void> => {
    if (flushing) {
      rerun = true
      return flushing
    }
    flushing = (async () => {
      do {
        rerun = false
        await flush()
      } while (rerun)
    })().finally(() => {
      flushing = undefined
    })
    return flushing
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
        timer = setTimeout(() => void runFlush(), FLUSH_MS)
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
      await runFlush()
    },
  }
}
