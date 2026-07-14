import { file, ref } from './refs'
import { isRecord } from './lib/isRecord'
import type { SeedDefinition } from './types'

export const SEED_PACKAGE = '@pro-laico/payload-seed'

const tokens = { ref, file }
const union = (values: string[]): string => (values.length ? values.map((v) => `'${v}'`).join(' | ') : 'never')

export function buildSeedRegistry(definitions: SeedDefinition[], packageName: string = SEED_PACKAGE): string {
  const collections: Record<string, Set<string>> = {}
  const globals = new Set<string>()

  for (const def of definitions) {
    if (def.kind === 'global') globals.add(def.slug)
    else if (def.kind === 'collection') {
      collections[def.slug] ??= new Set()
      const set = collections[def.slug]
      for (const rec of def.build(tokens)) if (isRecord(rec) && typeof rec._key === 'string') set?.add(rec._key)
    }
  }

  const lines = [`declare module '${packageName}' {`, '  interface SeedRegistry {', '    collections: {']
  for (const slug of Object.keys(collections).sort()) lines.push(`      '${slug}': ${union([...(collections[slug] ?? [])].sort())}`)
  lines.push('    }', `    globals: ${union([...globals].sort())}`, '  }', '}')
  return lines.join('\n')
}
