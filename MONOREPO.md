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
├── biome.json                 # formatter + linter (144-col, organizeImports off)
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
