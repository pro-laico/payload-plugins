import { pathToFileURL } from 'node:url'
import { glob } from 'tinyglobby'
import type { SeedDefinition } from '../types'

const IGNORE = ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/.turbo/**', '**/.source/**']

function isSeedDefinition(value: unknown): value is SeedDefinition {
  return (
    typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    ['collection', 'global', 'block', 'assets'].includes((value as { kind: string }).kind)
  )
}

/**
 * Auto-discover seed definitions by globbing for seed files and importing their default
 * exports. Works in any context that can dynamically import the matched source files
 * (Local API, `payload run`, tests). A bundled server may not be able to — pass
 * `definitions` explicitly there instead. Returns every default export that looks like a
 * `SeedDefinition`; other files are skipped.
 */
export async function discoverDefinitions(globs: string[], cwd: string): Promise<SeedDefinition[]> {
  const files = await glob(globs, { cwd, absolute: true, ignore: IGNORE })
  const definitions: SeedDefinition[] = []
  const errors: string[] = []
  for (const file of files.sort()) {
    let mod: { default?: unknown }
    try {
      mod = (await import(pathToFileURL(file).href)) as { default?: unknown }
    } catch (e) {
      // A matched file that isn't actually a seed module (e.g. a barrel using a path
      // alias the runtime can't resolve) shouldn't abort discovery — skip it. If it WAS
      // meant to be a seed file, the missing definition surfaces downstream.
      errors.push(`${file}: ${e instanceof Error ? e.message : String(e)}`)
      continue
    }
    if (isSeedDefinition(mod.default)) definitions.push(mod.default)
  }
  if (definitions.length === 0 && errors.length > 0) {
    throw new Error(
      `[payload-seed] discovery imported no seed definitions; ${errors.length} file(s) failed to import:\n  ${errors.join('\n  ')}`,
    )
  }
  return definitions
}
