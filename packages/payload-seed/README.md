# @pro-laico/payload-seed

Schema-aware, type-safe seeding for [Payload CMS](https://payloadcms.com/).

Write seed data in auto-discovered `seed.ts` files typed against your generated Payload
types, reference other docs and uploads with typed tokens instead of raw ids, and let the
plugin track dependencies, sort the seed order, validate against your live schema, and
emit a reviewable dependency graph. Ships the `POST /api/seed` endpoint, the `ENABLE_SEED`
kill-switch, and an optional admin button.

> **Status: in development.** The public API (plugin, `defineSeed`, `ref`/`asset`, run
> infra) is in place and type-safe; the run engine is being implemented incrementally.
> See [DESIGN.md](./DESIGN.md) for the full architecture.

## Install

```bash
pnpm add @pro-laico/payload-seed
```

## Use

```ts
// payload.config.ts
import { seedPlugin } from '@pro-laico/payload-seed'

export default buildConfig({
  plugins: [
    seedPlugin({
      enabled: process.env.ENABLE_SEED === 'true',
      assets: { dir: 'assets' },
      authorize: (user) => user.role === 'admin',
      adminButton: true,
    }),
  ],
})
```

```ts
// src/collections/Services/seed.ts — auto-discovered
import { defineSeed } from '@pro-laico/payload-seed'

export default defineSeed('services', ({ asset }) => [
  { _key: 'consulting', title: 'Consulting', slug: 'consulting', image: asset('serviceA') },
])
```

```ts
// src/collections/Posts/seed.ts — references the service across files
import { defineSeed } from '@pro-laico/payload-seed'

export default defineSeed('posts', ({ ref, asset }) => [
  { _key: 'launch', title: 'We launched', heroImage: asset('post'), relatedService: ref('services', 'consulting') },
])
```

## Why

- **Type-safe data** — each record is typed against `RequiredDataFromCollectionSlug<slug>`;
  change a collection and its seed file errors until it matches.
- **Type-safe references** — `ref('services', 'consulting')` is checked against a generated
  registry of declared keys; remove a seeded item and every reference to it errors.
- **Dependency tracking** — refs form a DAG; the engine topologically sorts the seed order,
  detects cycles, and validates that every reference resolves and targets a collection the
  field actually allows.
- **Reviewable graph** — emits `graph.html` (Mermaid) + `graph.json` after each run.
- **Robust media** — upload-first, MIME-by-real-extension, extension-mismatch tolerance,
  sequential uploads, missing-file guards, focal points.

## API

| Export | Purpose |
| --- | --- |
| `seedPlugin(options)` | The Payload plugin: endpoint + guard + optional admin button. |
| `defineSeed(slug, build)` | Define a collection's seed records. |
| `defineGlobalSeed(slug, build)` | Define a global's seed data. |
| `defineBlockSeed(blockType, build)` | Define a reusable block fragment for page layouts. |
| `ref(collection, key)` | Typed reference to another seeded doc. |
| `asset(key)` | Typed reference to an uploaded asset. |
| `createSeedEndpoint`, `seedingEnabled`, `runSeed` | Run infra for CLI runners / custom integrations. |

See [DESIGN.md](./DESIGN.md) for the engine pipeline, the codegen registry, and the media
registry.

## License

MIT
