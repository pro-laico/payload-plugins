// Vendors the kit into every plugin that registers collections.
//
// Why vendored and not imported: the packages transpile with swc file-by-file, which leaves bare
// specifiers alone — an `@tools/plugin-kit` import would survive into dist and break every consumer
// install, since the kit isn't published. Copying it in makes the import relative, so swc emits it
// into dist like any other module and nothing new appears in a consumer's dependency tree.
//
// Why committed and not gitignored: the packages' `exports` point `import` at ./src, so the
// sandboxes and typecheck load source — src/_kit has to exist the moment the repo is cloned, before
// any build runs. pnpm also disables pre/post scripts by default, so a `prebuild` hook would
// silently never fire. Committing the copies means a clone just works; `--check` in CI is what stops
// them drifting from the source.
//
//   pnpm kit:sync    -> rewrite the copies (run this after editing tools/plugin-kit/src)
//   pnpm kit:check   -> fail if any copy is stale (CI)

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = join(HERE, 'src')
const ROOT = resolve(HERE, '../..')

// Every plugin. The four that register collections honour the merge contract (each threads
// `override.slug` through its own internal references — the kit merges, the plugin propagates); the
// rest take the shared internals: binScriptPath, isRecord, authd.
const TARGETS = ['payload-images', 'payload-icons', 'payload-fonts', 'payload-mux', 'payload-seed', 'payload-revalidate', 'payload-dev-tools']

const HEADER = `// GENERATED — DO NOT EDIT. Source: tools/plugin-kit/src/%s
// Vendored by \`pnpm kit:sync\`; \`pnpm kit:check\` fails if this drifts from the source.
`

const check = process.argv.includes('--check')
const stale = []
let written = 0

for (const pkg of TARGETS) {
  const dest = join(ROOT, 'packages', pkg, 'src', '_kit')
  const files = readdirSync(SRC).filter((f) => f.endsWith('.ts'))

  if (!check) {
    rmSync(dest, { recursive: true, force: true })
    mkdirSync(dest, { recursive: true })
  }

  for (const file of files) {
    const body = HEADER.replace('%s', file) + readFileSync(join(SRC, file), 'utf8')
    const target = join(dest, file)
    if (check) {
      const current = existsSync(target) ? readFileSync(target, 'utf8') : null
      if (current !== body) stale.push(`packages/${pkg}/src/_kit/${file}`)
    } else {
      writeFileSync(target, body)
      written++
    }
  }
}

if (check) {
  if (stale.length) {
    console.error(`[plugin-kit] ${stale.length} vendored file(s) are stale — run \`pnpm kit:sync\` and commit:`)
    for (const f of stale) console.error(`  - ${f}`)
    process.exit(1)
  }
  console.log(`[plugin-kit] all vendored copies match the source (${TARGETS.length} packages)`)
} else {
  console.log(`[plugin-kit] vendored ${written} file(s) into ${TARGETS.length} packages`)
}
