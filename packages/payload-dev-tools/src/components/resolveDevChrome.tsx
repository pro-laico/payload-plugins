import { cookies } from 'next/headers'
import type { ReactNode } from 'react'
import { CHROME_COOKIES, type ChromeSlot } from '../cookies'
import { parseStage, type Test } from '../harness'

export type ResolveDevChromeOptions = {
  /** The same test array the `<DevToolbar>` receives — only `header`/`footer`-kind tests apply. */
  tests: Test[]
  /** The host's REAL `<SiteHeader />` — rendered whenever no header override is selected. */
  header: ReactNode
  /** The host's REAL `<SiteFooter />`. */
  footer: ReactNode
  /** Force on/off. Defaults to `NODE_ENV === 'development'` — in production the real chrome is
   *  returned untouched, cookies never read. */
  enabled?: boolean
}

/** Resolve one slot: its cookie must name a test of the MATCHING kind (a stale or cross-slot
 *  cookie falls back to the real chrome). Exported for the toolbar client to mirror the rule. */
export const chromeTestsFor = (tests: Test[], slot: ChromeSlot): Test[] => tests.filter((t) => t.kind === slot)

/**
 * The chrome-swap seam for the test harness — one line in your frontend layout:
 *
 *   const { header, footer } = await resolveDevChrome({ tests: devTests, header: <SiteHeader />, footer: <SiteFooter /> })
 *
 * Render `{header}` / `{footer}` where the real ones went. In production (or with no override
 * selected) you get exactly what you passed in; in dev, picking a `header`/`footer`-kind test
 * version in the toolbar's Tests view swaps that variant into the REAL layout, around REAL
 * content, across the whole site — browse every page wearing the candidate chrome, then hit
 * "Real" to reset. Server-only (reads cookies): call it from your layout, not client code.
 */
export async function resolveDevChrome({
  tests,
  header,
  footer,
  enabled,
}: ResolveDevChromeOptions): Promise<{ header: ReactNode; footer: ReactNode }> {
  if (!(enabled ?? process.env.NODE_ENV === 'development')) return { header, footer }

  const jar = await cookies()
  const resolve = async (slot: ChromeSlot, real: ReactNode): Promise<ReactNode> => {
    const stage = parseStage(jar.get(CHROME_COOKIES[slot])?.value, chromeTestsFor(tests, slot))
    if (!stage) return real
    try {
      return await stage.version.render()
    } catch {
      return real // a throwing variant must never take the whole site down
    }
  }

  const [h, f] = await Promise.all([resolve('header', header), resolve('footer', footer)])
  return { header: h, footer: f }
}
