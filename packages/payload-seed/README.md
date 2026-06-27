# @pro-laico/payload-seed

Schema-aware, type-safe seeding for [Payload CMS](https://payloadcms.com/).

Write seed data in `seed.ts` files typed against your generated Payload types, reference
other docs and uploads with typed tokens instead of raw ids, and let the plugin track
dependencies, sort the seed order, validate against your live schema, and emit a reviewable
dependency graph. Ships the `POST /api/seed` endpoint, the `ENABLE_SEED` kill-switch, an
optional admin button, and typed ref keys injected into `payload-types.ts`.

> **Status: working, pre-1.0.** The plugin, `defineSeed`/`ref`/`asset`, the run engine
> (definitions → assets → graph → validate → topo-sort → clear → create → artifact), the
> endpoint, the `payload seed` command, and the typed `SeedRegistry` (injected into
> `payload-types.ts` via `typescript.postProcess`) are implemented and tested (unit + a
> Payload integration test in the `seed-sandbox` example). Still to come: field-level schema
> validation. See [DESIGN.md](./DESIGN.md) for the full architecture.

## Install

```bash
pnpm add @pro-laico/payload-seed
```

## Use

```ts
// src/plugins/index.ts — import your seed definitions and hand them to the plugin
import { seedPlugin } from '@pro-laico/payload-seed'
import services from '../collections/Services/seed'
import posts from '../collections/Posts/seed'
import assets from '../seed/assets'

export const plugins = [
  seedPlugin({
    enabled: process.env.ENABLE_SEED === 'true',
    assets: { dir: 'assets' },
    authorize: (user) => user.role === 'admin',
    adminButton: true,
    definitions: [assets, services, posts], // feeds the endpoint AND the generated types
  }),
]
```

```ts
// src/collections/Services/seed.ts
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
- **Type-safe references** — `ref('services', 'consulting')` is checked against a
  `SeedRegistry` of declared keys, injected into `payload-types.ts` during `generate:types`;
  remove a seeded item and every reference to it errors. Global, no import (like Payload's
  own generated types).
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
| `ref(collection, key)` | Typed reference to another seeded doc. |
| `asset(key)` | Typed reference to an uploaded asset. |
| `defineAssets(specs)` | Declare the uploadable assets `asset()` resolves to. |
| `buildSeedRegistry(definitions)` | Builds the `SeedRegistry` augmentation string. The plugin injects it into `payload-types.ts` via `typescript.postProcess`; you don't call it directly. |
| `seed`, `createSeedEndpoint`, `seedingEnabled`, `runSeed` | Run infra. The plugin also registers a `payload seed` command (Payload `config.bin`) so projects need no runner script. |

See [DESIGN.md](./DESIGN.md) for the engine pipeline, the codegen registry, and the media
registry.

## License

MIT
