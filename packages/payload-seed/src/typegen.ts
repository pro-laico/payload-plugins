import { asset, ref } from './refs'
import type { SeedDefinition } from './types'

/** Module name whose `SeedRegistry` interface the generated augmentation targets. */
export const SEED_PACKAGE = '@pro-laico/payload-seed'

const tokens = { ref, asset }
const union = (values: string[]): string => (values.length ? values.map((v) => `'${v}'`).join(' | ') : 'never')

/**
 * Build the `declare module '@pro-laico/payload-seed' { interface SeedRegistry … }`
 * augmentation from the in-memory seed definitions — collection `_key`s, global slugs, and
 * asset keys. The plugin appends this to Payload's generated types via
 * `typescript.postProcess`, so `ref()`/`asset()` keys are type-checked in `payload-types.ts`
 * (rename/remove a seeded item, regenerate, and every reference errors). No filesystem
 * access — the keys come from the same definition data the engine seeds.
 */
export function buildSeedRegistry(definitions: SeedDefinition[], packageName: string = SEED_PACKAGE): string {
  const collections: Record<string, Set<string>> = {}
  const globals = new Set<string>()
  const assets = new Set<string>()

  for (const def of definitions) {
    if (def.kind === 'assets') for (const k of Object.keys(def.specs)) assets.add(k)
    else if (def.kind === 'global') globals.add(def.slug)
    else if (def.kind === 'collection') {
      collections[def.slug] ??= new Set()
      const set = collections[def.slug]
      for (const rec of def.build(tokens)) set?.add((rec as { _key: string })._key)
    }
  }

  const lines = [`declare module '${packageName}' {`, '  interface SeedRegistry {', '    collections: {']
  for (const slug of Object.keys(collections).sort()) lines.push(`      '${slug}': ${union([...(collections[slug] ?? [])].sort())}`)
  lines.push('    }', `    globals: ${union([...globals].sort())}`, `    assets: ${union([...assets].sort())}`, '  }', '}')
  return lines.join('\n')
}
