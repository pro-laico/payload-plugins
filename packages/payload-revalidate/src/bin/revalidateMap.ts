import { writeFileSync } from 'node:fs'
import type { SanitizedConfig } from 'payload'

import { renderRevalidateMap } from '../lib/map/report'
import { buildStaticInspection } from '../lib/map/build'

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
