import { writeFileSync } from 'node:fs'
import type { SanitizedConfig } from 'payload'

import { buildStaticInspection } from '../map/build'
import { renderRevalidateMap } from '../map/report'

/**
 * Payload custom-bin entry. `revalidatePlugin` registers this under `config.bin` as the
 * `revalidate-map` command, so `payload revalidate-map` prints the project's cache
 * dependency map — no per-project runner script, no server booted. Payload's CLI loads the
 * config and hands it here; the map is derived purely from it (graph + resolved settings +
 * rules), reading the plugin's own options back out of `config.custom.payloadRevalidate`.
 *
 *   payload revalidate-map > REVALIDATION.md   # Markdown (default) to a repo doc
 *   payload revalidate-map --json --out revalidate-map.json
 */
export const script = async (config: SanitizedConfig): Promise<void> => {
  const argv = process.argv.slice(2)
  const json = argv.includes('--json')
  const outIdx = Math.max(argv.indexOf('--out'), argv.indexOf('-o'))
  const out = outIdx !== -1 ? argv[outIdx + 1] : undefined

  const inspection = buildStaticInspection(config)
  const output = json ? JSON.stringify(inspection, null, 2) : renderRevalidateMap(inspection)

  if (out) {
    writeFileSync(out, `${output}\n`)
    process.stderr.write(`[payload-revalidate] wrote ${out}\n`)
  } else {
    process.stdout.write(`${output}\n`)
  }
  process.exit(0)
}
