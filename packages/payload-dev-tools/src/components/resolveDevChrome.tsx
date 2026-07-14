import { cookies } from 'next/headers'
import type { ReactNode } from 'react'

import { parseStage } from '../harness'
import { CHROME_COOKIES } from '../cookies'
import type { ChromeSlot, ResolveDevChromeOptions, Test } from '../types'

export const chromeTestsFor = (tests: Test[], slot: ChromeSlot): Test[] => tests.filter((t) => t.kind === slot)

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
      return real
    }
  }

  const [h, f] = await Promise.all([resolve('header', header), resolve('footer', footer)])
  return { header: h, footer: f }
}
