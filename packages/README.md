# packages/

Published Payload CMS plugins. Each subdirectory is a standalone, npm-published
package under the `@pro-laico/*` scope (e.g. `@pro-laico/payload-<name>`).

## Adding a plugin

Create a new directory `packages/payload-<name>/` with the standard package shape:

- A `(opts) => (config) => config` plugin factory as both the default export and a
  named export, with the raw collections / hooks / fields / components also exported
  as named imports for advanced consumers.
- `package.json` with the `src → dist` `publishConfig` swap (dev consumes `src`
  directly; the published tarball points `main`/`types`/`exports` at `dist`), a
  `prepack` build (`swc` + `tsc --emitDeclarationOnly`), and `payload` / `next` /
  `react` as `peerDependencies`.
- `tsconfig.json` extending the root `tsconfig.base.json`.

All `@pro-laico/*` packages share one version (Payload-style lockstep) and are
versioned + published together — see `tools/releaser`.
