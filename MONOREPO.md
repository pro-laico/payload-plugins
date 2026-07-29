# Monorepo Development

This document is for contributors working on the Payload Plugins monorepo —
structure, local development, and publishing.

## Structure

```
payload-plugins/
├── packages/                  # published Payload plugins (@pro-laico/payload-*)
├── examples/                  # minimal Payload + Next.js test apps (private)
├── docs/                      # documentation site (fumadocs, port 43210)
├── tools/
│   ├── releaser/              # lockstep versioning + npm publish tooling
│   ├── sandbox-shell/         # shared example frontend shell
│   └── failure-lab/           # Payload integration-test rig
├── tsconfig.base.json         # shared TS config every package extends
├── biome.jsonc                # formatter + linter (144-col, organizeImports off)
├── .swcrc                     # package build config (src -> dist)
├── turbo.json                 # task graph (build, typecheck)
└── package.json               # workspace root
```

## Workspace groups

| Group        | Published? | Versioned in lockstep? | Description                                        |
| ------------ | ---------- | ---------------------- | -------------------------------------------------- |
| `packages/*` | yes        | yes                    | The plugins, published to npm under `@pro-laico/*`. |
| `examples/*` | no         | yes                    | Minimal test apps that consume a plugin.            |
| `docs`       | no         | no                     | The documentation site.                             |
| `tools/*`    | no         | no                     | Internal tooling (releaser, sandbox-shell, failure-lab). |

### How the examples read data

Every example reads Payload through cached, tagged getters in `src/lib/getters.ts` — the pattern a
real site ships — so its pages prerender and a write busts the tag. None of them mark a page dynamic
to dodge the cache.

That has one consequence worth knowing when you work on them: a build that prerenders a database
read needs a schema, and Payload only pushes one outside production (`db-sqlite` gates push on
`NODE_ENV !== 'production'`). Since these apps hold nothing but seed data, `prebuild` simply seeds:

```jsonc
"prebuild": "cross-env ENABLE_SEED=true pnpm payload seed"
```

That boots Payload outside production — pushing the schema on the way — and leaves the build real
content to prerender instead of an empty database. `pnpm build` works on a fresh clone with no `.db`
file, and CI needs no environment beyond the repo. `pnpm dev` is unchanged.

Two things follow. **A build reseeds**, which is destructive by design — the seeded collections are
wiped and rewritten, so don't keep anything in an example database you aren't willing to lose. And
the build opts into `ENABLE_SEED` explicitly rather than relying on `.env.local`, which is gitignored
and absent in CI; the guard still protects the endpoint and the admin button everywhere else.

## Commands

All commands run from the monorepo root.

| Command                                   | What it does                                              |
| ----------------------------------------- | --------------------------------------------------------- |
| `pnpm build`                              | Build every package (`turbo run build`).                  |
| `pnpm typecheck`                          | `tsc --noEmit` in every workspace project.                |
| `pnpm check`                              | Biome format + lint + safe fixes (writes).                |
| `pnpm check:ci`                           | Biome check, no writes (CI gate).                         |
| `pnpm docs`                               | Run the documentation site in dev.                        |
| `pnpm --filter <name> typecheck`          | Typecheck a single package by its `name` field.           |
| `pnpm --filter "@pro-laico/*" build`      | Build only the published packages.                        |

## Package shape

Each `packages/payload-<name>` is an independently published package:

- A `(opts) => (config) => config` plugin factory as both the default export and a
  named export, with the raw collections / hooks / fields / components also exported
  as named imports for advanced consumers.
- `package.json` with a `publishConfig` `src → dist` swap (dev consumes `src`
  directly via the workspace; the published tarball points `main`/`types`/`exports`
  at `dist`), a `prepack` build (`swc` for JS + `tsc --emitDeclarationOnly` for
  types, `copyfiles` for non-TS assets), and `payload` / `next` / `react` as
  `peerDependencies`.
- `tsconfig.json` that `extends` the root `tsconfig.base.json`.

Examples consume their plugin with `workspace:*` so package changes are picked up
immediately in dev.

### Querying from inside a hook

A `payload.find` called from a hook passes `pagination: false` unless it genuinely
needs the total count. A paginated find issues its count and its query
**concurrently on one database session**. In the middle of a transaction that is
harmless, but when such a find is the transaction's first command — which is
exactly what a `before*` hook is — the two race `startTransaction`: only one can
carry it, the other is rejected with `NoSuchTransaction`, and MongoDB aborts the
transaction. Every later command in the same transaction then fails with the same
message, so the visible error is always fallout and never names the hook.

Prefer `payload.count` when you want a count, and `payload.findByID` when you have
an id — both issue a single command and are safe anywhere.

## Releasing & publishing

All `@pro-laico/*` packages share one version (Payload-style lockstep) and are
published together. The flow:

1. `pnpm release` — stamp the next version across the root + every `packages/*` and
   `examples/*`, then commit and tag. See `tools/releaser/README.md` for flags
   (`--bump`, `--dry-run`, …).
2. `git push --follow-tags` — pushing a `v*` tag triggers
   `.github/workflows/release.yml`, which builds and publishes with npm provenance.

| Command                           | What it does                                                              |
| --------------------------------- | ------------------------------------------------------------------------ |
| `pnpm release`                    | Lockstep version bump + commit + tag (no publish). `--dry-run` to preview. |
| `pnpm publish-packages`           | Build (`prepack`) + `pnpm publish` every non-private `packages/*` to npm.   |
| `pnpm publish-packages --dry-run` | Build + pack every publishable package without uploading.                  |

Each `pnpm publish` runs the package's `prepack` and pnpm rewrites `workspace:*`
deps to the concrete shared version. Examples, docs, and `tools/*` are never
published.

One-time setup for CI publishing: each new package must be published locally once
(`npm login` + `pnpm publish-packages`), then add a Trusted Publisher on npmjs.com
pointing at this repo + `.github/workflows/release.yml`. After that, tag pushes
publish automatically. See `tools/releaser/README.md`.

## Adding a plugin

1. `mkdir packages/payload-<name>` and add the package shape above.
2. Add an example in `examples/<name>/` that consumes it with `workspace:*`.
3. Document it under `docs/content/docs/plugins/<name>.mdx`.
