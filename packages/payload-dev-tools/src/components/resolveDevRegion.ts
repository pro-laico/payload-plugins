import { cookies } from 'next/headers'

import { regionFor } from '../lib/regions'
import { devEnabled } from '../lib/devEnabled'
import { REGION_COOKIE } from '../cookies'
import type { DevRegion, ResolveDevRegionOptions } from '../types'

/** The location seam: hand it the region your app really determined (a geo header, usually) and it
 * hands back that region — or, in development with the toolbar's Region toggle set, the one you're
 * pretending to be. Branch your consent banner on the returned `consent` / `regime`.
 *
 * Outside development it returns before touching cookies, so a page that would prerender still
 * does. An unknown code resolves to `undefined`: the caller decides what no-idea-where-they-are
 * means (defaulting to the strictest regime is the usual answer). */
export async function resolveDevRegion({ region, regions, enabled }: ResolveDevRegionOptions): Promise<DevRegion | undefined> {
  const real = regionFor(region, regions)
  if (!devEnabled(enabled)) return real

  const jar = await cookies()
  return regionFor(jar.get(REGION_COOKIE)?.value, regions) ?? real
}
