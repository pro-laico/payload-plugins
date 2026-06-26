# Payload Plugins

A monorepo of composable [Payload CMS](https://payloadcms.com/) plugins published
under the `@pro-laico/*` scope, the test apps that exercise them, and a
documentation site.

```
payload-plugins/
├── packages/     # published Payload plugins (@pro-laico/payload-*)
├── examples/     # minimal Payload + Next.js test apps (private)
├── docs/         # documentation site (fumadocs)
└── tools/
    └── releaser/ # lockstep versioning + npm publish tooling
```

## Quick start

```bash
pnpm install
pnpm docs          # run the documentation site
pnpm build         # build every package (turbo)
pnpm typecheck     # typecheck every workspace project
pnpm check         # Biome format + lint + safe fixes
```

## Tooling

- **pnpm workspaces + Turborepo** — `packages/*`, `examples/*`, `tools/*`, `docs`.
- **Biome** — formatter + linter (144-col line width, import organizing off). See
  `biome.json`. CI runs `pnpm check:ci`.
- **TypeScript** — packages extend the shared `tsconfig.base.json`.
- **swc** — builds packages from `src` to `dist` on `prepack` (`.swcrc`).

## Releasing

All `@pro-laico/*` packages share one version (Payload-style lockstep) and are
published together:

1. `pnpm release` — stamp the next version across the root + every `packages/*` and
   `examples/*`, then commit and tag. See `tools/releaser/README.md` for flags.
2. `git push --follow-tags` — pushing a `v*` tag triggers
   `.github/workflows/release.yml`, which publishes to npm with provenance.

See [MONOREPO.md](./MONOREPO.md) for full contributor docs.

## License

MIT — see [LICENSE.md](./LICENSE.md). Not affiliated with Payload CMS in any capacity.
