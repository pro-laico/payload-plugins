# @tools/smoke

Packs every `@pro-laico/*` package and installs the tarballs into a plain app **outside** the
workspace, so the thing consumers actually install gets exercised at least once.

```bash
pnpm smoke     # from the repo root
```

> **It rebuilds `dist`.** Packing runs each package's `prepack` → `pnpm build`, which starts with
> `rimraf dist`. So don't run it next to a turbo task in the same checkout — a `typecheck` that
> depends on `^build` can read a `dist/` that's mid-rebuild and fail for no real reason. CI runs it
> as its own job on its own runner, so nothing overlaps.

## Why this exists

In the workspace, every package's `exports` points at `./src/*.ts` and the sandboxes, tests, and
failure-lab all load **source**. On publish, `publishConfig` swaps `exports` to `./dist/*.js` and
`files: ["dist"]` ships only the build. Those are different packages. Nothing else in this repo ever
loads the second one, and pnpm's workspace links realpath outside `node_modules`, so the sandboxes
can't catch a `node_modules`-only resolution failure even in principle.

That gap has already cost us: `dist` imported `@payload-config`, an alias that only exists in the
consumer's tsconfig — which bundlers do not apply to `node_modules`. Every test was green.

`pnpm pack` applies `publishConfig` and runs each package's `prepack` → `pnpm build`, so the
tarballs are what `pnpm publish` would upload, freshly built. A stale `dist` cannot pass.

## What it checks

1. **Every package packs** — `prepack` builds it first.
2. **`npm install` of the tarballs succeeds** in a plain, non-workspace app (npm, so nothing can
   quietly link back to the monorepo), whose tsconfig has **no `@payload-config` path**.
3. **Every `exports` target exists** in the installed package — catches a `files` gap, an entry
   pointing at something the build never emitted, and a `publishConfig` swap that didn't happen.
4. **No `@payload-config` in the shipped code** — the same rule `tools/failure-lab`'s doctrine test
   enforces on `src/`, applied to the artifact.
5. **The server entrypoints import for real**, under `--conditions=react-server` (how Next resolves
   an RSC graph, and what makes `server-only` loadable outside a bundler).

## What it does NOT check

- **Rendering.** This is a resolution test. It doesn't run a Next build, so it can't catch a
  Turbopack-specific resolution quirk or a client component that's broken at runtime.
- **Client components / admin panels.** They pull `@payloadcms/ui` and its CSS, which only a bundler
  can load, so they're covered by (3) — the file exists and the exports map points at it — not by an
  import.
- **Bundler-only specifiers.** Some entrypoints legitimately import things only a bundler resolves
  (`next/link`, `next/server`). Those are reported as `skipped`, not failures: a real consumer
  resolves them through Next. A module missing from *inside* one of our packages is always a
  failure.

If (5) starts skipping an entrypoint you expected to import, that's worth a look — it means the
package reached for a bundler-owned specifier it didn't used to need.
