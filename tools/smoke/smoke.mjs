// Exercises the PUBLISHED artifact, which nothing else in this repo does.
//
// In the workspace every package's `exports` points at `./src/*.ts` and apps import source. On
// publish, `publishConfig` swaps `exports` to `./dist/*.js` and `files: ["dist"]` ships only the
// build — a completely different package from the one the tests, sandboxes, and failure-lab load.
// So a stale `dist`, a file missing from `files`, an `exports` entry pointing at something that was
// never built, or an import of `@payload-config` (which a consumer cannot resolve from node_modules)
// all ship green and fail in someone else's app. That happened.
//
// `pnpm pack` applies publishConfig and runs each package's `prepack` -> `pnpm build`, so the
// tarballs here are exactly what `pnpm publish` would upload, freshly built.
//
// Deliberately NOT a Next build: this checks resolution, not rendering. It cannot catch a
// Turbopack-specific resolution quirk or a broken client component. See tools/smoke/README.md.

import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const PACKAGES_DIR = join(ROOT, 'packages')

// The peers a consumer supplies. Pinned to what the example apps run, so a resolution failure here
// means the artifact is wrong, not that the smoke app drifted onto some other Payload.
const PEERS = {
  '@payloadcms/ui': '^3.85.2',
  graphql: '^16.14.2',
  next: '^16.2.10',
  payload: '^3.85.2',
  react: '^19.2.7',
  'react-dom': '^19.2.7',
  sharp: '^0.35.2',
}

// Subpaths whose module graph is server-side, so plain Node can attempt them. Admin panels and
// client components pull @payloadcms/ui and its CSS, which only a bundler can load — those are
// covered by resolving their exports target to a real file instead.
const IMPORTABLE = new Set(['.', './cache', './toolbar', './utils/urls'])

const failures = []
const fail = (message) => {
  failures.push(message)
  console.error(`  ✗ ${message}`)
}
const pass = (message) => console.log(`  ✓ ${message}`)

const WIN = process.platform === 'win32'
const run = (cmd, args, cwd, shell = false) => execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], shell })
// npm/pnpm are .cmd shims on Windows, which Node refuses to execFile without a shell. node itself
// must NOT go through the shell — its path has a space in it on Windows.
const runPm = (cmd, args, cwd) => run(WIN ? `${cmd}.cmd` : cmd, args, cwd, WIN)

/** Every file an exports map can point at, as [subpath, relative target] pairs. */
const exportTargets = (exports) => {
  const out = []
  const walk = (subpath, node) => {
    if (typeof node === 'string') out.push([subpath, node])
    else if (node && typeof node === 'object') for (const value of Object.values(node)) walk(subpath, value)
  }
  for (const [subpath, node] of Object.entries(exports ?? {})) walk(subpath, node)
  return out
}

const publicPackages = readdirSync(PACKAGES_DIR)
  .map((dir) => join(PACKAGES_DIR, dir, 'package.json'))
  .filter((file) => existsSync(file))
  .map((file) => ({ dir: dirname(file), manifest: JSON.parse(readFileSync(file, 'utf8')) }))
  .filter(({ manifest }) => !manifest.private && manifest.name?.startsWith('@pro-laico/'))

if (publicPackages.length === 0) throw new Error('[smoke] no publishable packages found under packages/')

const scratch = mkdtempSync(join(tmpdir(), 'payload-plugins-smoke-'))
console.log(`[smoke] ${publicPackages.length} packages -> ${scratch}\n`)

try {
  // 1. Pack. `prepack` builds each package first, so a stale dist can't slip through.
  console.log('[smoke] packing (this builds each package)…')
  const tarballs = {}
  for (const { dir, manifest } of publicPackages) {
    const out = runPm('pnpm', ['pack', '--pack-destination', scratch], dir).trim()
    const tarball = out.split('\n').at(-1).trim()
    if (!existsSync(tarball)) throw new Error(`[smoke] pnpm pack did not produce a tarball for ${manifest.name} (got: ${out})`)
    tarballs[manifest.name] = tarball
    pass(`packed ${manifest.name}`)
  }

  // 2. A plain consumer: npm (not pnpm — no workspace to link back to), and NO @payload-config
  // path in tsconfig, which is the alias that made dist unresolvable for real consumers.
  writeFileSync(
    join(scratch, 'package.json'),
    `${JSON.stringify(
      {
        name: 'payload-plugins-smoke',
        private: true,
        type: 'module',
        dependencies: { ...PEERS, ...Object.fromEntries(Object.entries(tarballs).map(([name, file]) => [name, `file:${file}`])) },
      },
      null,
      2,
    )}\n`,
  )
  writeFileSync(join(scratch, 'tsconfig.json'), `${JSON.stringify({ compilerOptions: { moduleResolution: 'bundler' } }, null, 2)}\n`)

  console.log('\n[smoke] installing the tarballs into a plain app…')
  runPm('npm', ['install', '--no-audit', '--no-fund', '--loglevel', 'error'], scratch)
  pass('npm install')

  // 3. Every exports target must exist in the installed package. This is what catches a `files`
  // gap or an exports entry pointing at something the build never emitted.
  console.log('\n[smoke] exports map -> real files')
  for (const name of Object.keys(tarballs)) {
    const installed = join(scratch, 'node_modules', ...name.split('/'))
    const manifest = JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8'))

    if (manifest.exports === undefined) fail(`${name}: installed package has no exports map`)
    for (const [subpath, target] of exportTargets(manifest.exports)) {
      if (target.startsWith('./src/')) fail(`${name} ${subpath}: exports still points at source (${target}) — publishConfig didn't swap`)
      else if (!existsSync(join(installed, target))) fail(`${name} ${subpath}: exports -> ${target}, which is not in the package`)
    }
    if (!existsSync(join(installed, 'dist'))) fail(`${name}: no dist/ in the published package`)
    else pass(`${name}: ${exportTargets(manifest.exports).length} export targets present`)
  }

  // 4. The shipped code must not reach for @payload-config: the alias lives in the consumer's
  // tsconfig, which bundlers do not apply to node_modules. The doctrine test guards src/; this is
  // the same rule enforced on the artifact.
  console.log('\n[smoke] no @payload-config in the shipped code')
  for (const name of Object.keys(tarballs)) {
    const installed = join(scratch, 'node_modules', ...name.split('/'))
    const offenders = []
    const walk = (dir) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        if (statSync(full).isDirectory()) walk(full)
        else if (/\.(js|mjs|cjs|d\.ts)$/.test(entry) && readFileSync(full, 'utf8').includes('@payload-config')) offenders.push(full)
      }
    }
    walk(join(installed, 'dist'))
    if (offenders.length) fail(`${name}: @payload-config in ${offenders.map((f) => f.replace(installed, '')).join(', ')}`)
    else pass(`${name}: clean`)
  }

  // 5. Load the server entrypoints for real. --conditions=react-server is how Next resolves an RSC
  // graph, and it's what makes `server-only` importable outside a bundler.
  console.log('\n[smoke] importing server entrypoints (--conditions=react-server)')
  const specifiers = []
  for (const name of Object.keys(tarballs)) {
    const manifest = JSON.parse(readFileSync(join(scratch, 'node_modules', ...name.split('/'), 'package.json'), 'utf8'))
    for (const subpath of Object.keys(manifest.exports ?? {})) {
      if (IMPORTABLE.has(subpath)) specifiers.push(subpath === '.' ? name : `${name}/${subpath.slice(2)}`)
    }
  }
  // Import each on its own and classify the failures. A module missing from INSIDE one of our
  // packages is a broken artifact. A bare specifier a bundler owns (`next/link` has no Node-
  // resolvable export) is not ours to fix and doesn't mean the package is broken — a real consumer
  // resolves it through Next. Reporting those as failures would make this test cry wolf.
  const probe = join(scratch, 'probe.mjs')
  writeFileSync(
    probe,
    [
      `const specifiers = ${JSON.stringify(specifiers)}`,
      'const results = []',
      'for (const specifier of specifiers) {',
      '  try {',
      '    await import(specifier)',
      "    results.push({ specifier, status: 'ok' })",
      '  } catch (err) {',
      "    results.push({ specifier, status: 'error', code: err?.code ?? '', url: err?.url ?? '', message: String(err?.message ?? err).split('\\n')[0] })",
      '  }',
      '}',
      'console.log(JSON.stringify(results))',
    ].join('\n'),
  )
  const results = JSON.parse(run(process.execPath, ['--conditions=react-server', probe], scratch).trim().split('\n').at(-1))
  for (const { specifier, status, code, url, message } of results) {
    if (status === 'ok') pass(`import ${specifier}`)
    else if (code === 'ERR_MODULE_NOT_FOUND' && !url.includes('@pro-laico'))
      console.log(`  – skipped ${specifier}: needs a bundler (${message})`)
    else fail(`import ${specifier}: ${message}`)
  }
} catch (err) {
  fail(err instanceof Error ? err.message : String(err))
} finally {
  rmSync(scratch, { recursive: true, force: true })
}

console.log('')
if (failures.length) {
  console.error(`[smoke] FAILED — ${failures.length} problem${failures.length === 1 ? '' : 's'} with the published artifact:`)
  for (const f of failures) console.error(`  - ${f}`)
  process.exit(1)
}
console.log('[smoke] the published artifact installs and resolves in a plain app ✓')
