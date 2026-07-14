import { after } from 'next/server'
import type { Payload } from 'payload'

import { recordIconMiss } from './recordMiss'

import 'server-only'

const THROTTLE_MS = 60_000
const MAX_TRACKED = 500
const lastRecorded = new Map<string, number>()

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
      } catch {}
    })
  } catch {}
}
