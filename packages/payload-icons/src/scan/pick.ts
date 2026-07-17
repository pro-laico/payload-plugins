import type { IconUsageManifest } from '../types'

/** Choose which usage manifest the panel reports from: the live dev scan, or the one the CLI wrote.
 *
 * A live scan that finds nothing is absence of evidence, not proof the repo requests no icons — it
 * looks identical to a scan that couldn't see the code at all (a cwd that isn't the app root, roots
 * outside `src` / `app`, an aliased `<Icon>` tag). The live scanner can't tell those apart either,
 * since it swallows every fs error and returns an empty-but-truthy manifest. So prefer whichever
 * source actually found names: an empty live result must not shadow a manifest that has them.
 */
export const pickUsageManifest = (live: IconUsageManifest | null, stored: IconUsageManifest | null): IconUsageManifest | null =>
  live?.names.length ? live : stored
