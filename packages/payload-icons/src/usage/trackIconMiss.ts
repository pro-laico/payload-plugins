import 'server-only'

import { after } from 'next/server'
import type { Payload } from 'payload'

import { recordIconMiss } from './recordMiss'

/** Don't write the same name more than once per this window per process. */
const THROTTLE_MS = 60_000
/** Evict stale throttle entries once the map exceeds this — dynamic names would otherwise grow it forever. */
const MAX_TRACKED = 500
const lastRecorded = new Map<string, number>()

/**
 * Fire-and-forget runtime recorder for an unresolved icon name, writing through
 * the caller's own handle (the `createIcon` factory's seeded session). Called by
 * the icon server component when a name doesn't resolve. NEVER blocks rendering
 * or throws:
 *
 * - Throttled per name per process (so a hot page doesn't hammer the DB).
 * - Deferred via Next's `after()` so the write runs AFTER the response streams
 *   (and the serverless function stays alive to finish it).
 * - Best-effort: every failure is swallowed, and it's a no-op unless the
 *   `iconRequest` collection is registered (see {@link recordIconMiss}).
 *
 * Force-disable with `ICON_USAGE_TRACKING=false`.
 */
export const trackIconMiss = (payload: Payload | Promise<Payload>, name: string): void => {
  if (!name || process.env.ICON_USAGE_TRACKING === 'false') return

  const now = Date.now()
  const last = lastRecorded.get(name)
  if (last !== undefined && now - last < THROTTLE_MS) return
  if (lastRecorded.size >= MAX_TRACKED) {
    for (const [key, at] of lastRecorded) if (now - at >= THROTTLE_MS) lastRecorded.delete(key)
  }
  lastRecorded.set(name, now)

  try {
    after(async () => {
      try {
        await recordIconMiss(await payload, name)
      } catch {
        // Telemetry is best-effort — never surface its failures.
      }
    })
  } catch {
    // `after()` was called outside a request scope (e.g. static prerender) — skip.
  }
}
