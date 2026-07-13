import { recordEvent } from './observe/registry'
import type { Bust, RevalidateEvent } from '../types'
import { createOnce } from './once'

/** Warned-once guard so a non-request context doesn't spam the console. */
const warnOutsideRequestOnce = createOnce()

/** Run `fn` with Next's known single-arg-revalidateTag deprecation nag filtered out. The
 *  warn is emitted synchronously at the top of `revalidateTag`, so the patch window is one
 *  sync call; only that exact message is dropped, everything else passes through. */
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

/**
 * Bust one tag through Next, safely from any context — with EXPIRE-NOW semantics, so an
 * admin edit is visible on the very next request instead of after one stale serve:
 *
 * 1. `updateTag(tag)` — Cache Components' expire-now primitive. Succeeds when the write
 *    runs inside a server action (e.g. app code calling `payload.update` from one);
 *    Next hard-rejects it in route handlers (Payload's REST endpoints).
 * 2. `revalidateTag(tag)` (single-arg) — the route-handler expire-now path. Next nags
 *    toward the two-arg form, but `revalidateTag(tag, 'max')` is stale-while-revalidate
 *    (one stale serve after every edit) and `updateTag` is barred here, so the nag —
 *    filtered above, it carries no signal — is the price of read-your-writes.
 *
 * `next/cache` is imported lazily: the `.` entry stays statically Next-free (importable
 * from `payload.config` in any process), and contexts with no request store (CLI seeds,
 * `payload run` scripts) swallow the error instead of failing the write.
 */
export const safeRevalidate = async (tag: string): Promise<void> => {
  let mod: { updateTag?: (tag: string) => void; revalidateTag: (tag: string, profile?: string) => void }
  try {
    mod = (await import('next/cache')) as typeof mod
  } catch {
    return // no Next here (unit tests, plain node) — nothing to bust
  }
  try {
    if (typeof mod.updateTag === 'function') return mod.updateTag(tag)
  } catch {
    // updateTag rejected this context (route handler / older Next) — fall through.
  }
  try {
    withoutSingleArgNag(() => mod.revalidateTag(tag))
  } catch (err) {
    // Once per process, EVERY environment: a CLI seed hitting this is expected one-line
    // noise, but a production jobs runner (scheduled publish, worker) hitting it means
    // busts are silently never reaching the cache — that must be visible in prod logs.
    if (warnOutsideRequestOnce('outside-request')) {
      console.warn(
        `[payload-revalidate] revalidateTag('${tag}') was a no-op — no Next request scope in this process. Normal for CLI seeds/scripts; if this is a long-lived server (jobs runner, scheduled publish), revalidation is NOT reaching the cache:`,
        err instanceof Error ? err.message : err,
      )
    }
  }
}

/**
 * The single write-side sink: record the event for the dependency map, then bust each
 * unique tag. Recording happens FIRST so the map shows intent even where `revalidateTag`
 * can't reach a cache (tests, CLI).
 */
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
