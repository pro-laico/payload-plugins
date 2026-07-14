import { createOnce } from './once'
import { recordEvent } from './observe/registry'
import type { Bust, RevalidateEvent } from '../types'

const warnOutsideRequestOnce = createOnce()

const withoutSingleArgNag = <T>(fn: () => T): T => {
  const original = console.warn
  console.warn = (...args: unknown[]): void => {
    if (typeof args[0] === 'string' && args[0].startsWith('"revalidateTag" without the second argument')) return
    original.apply(console, args)
  }
  try {
    return fn()
  } finally {
    console.warn = original
  }
}

export const safeRevalidate = async (tag: string): Promise<void> => {
  let mod: { updateTag?: (tag: string) => void; revalidateTag: (tag: string, profile?: string) => void }
  try {
    mod = (await import('next/cache')) as typeof mod //TODO: replace `as` cast with proper typing
  } catch {
    return
  }
  try {
    if (typeof mod.updateTag === 'function') return mod.updateTag(tag)
  } catch {}
  try {
    withoutSingleArgNag(() => mod.revalidateTag(tag))
  } catch (err) {
    if (warnOutsideRequestOnce('outside-request')) {
      console.warn(
        `[payload-revalidate] revalidateTag('${tag}') was a no-op — no Next request scope in this process. Normal for CLI seeds/scripts; if this is a long-lived server (jobs runner, scheduled publish), revalidation is NOT reaching the cache:`,
        err instanceof Error ? err.message : err,
      )
    }
  }
}

export const bust = async (
  busts: Bust[],
  trigger: RevalidateEvent['trigger'],
  source: RevalidateEvent['source'],
  observe: boolean,
): Promise<void> => {
  const unique = [...new Map(busts.map((b) => [b.tag, b])).values()]
  if (unique.length === 0) return
  recordEvent(observe, { source, trigger, busted: unique })
  for (const { tag } of unique) await safeRevalidate(tag)
}
