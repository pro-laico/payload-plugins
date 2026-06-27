# @pro-laico/payload-seed

Type-safe database seeding for [Payload CMS](https://payloadcms.com/). Write seed data in
`seed.ts` files, reference other docs and uploads with typed tokens instead of raw ids, and
the plugin orders dependencies, uploads media, and creates everything — behind an
`ENABLE_SEED` kill switch.

```bash
pnpm add @pro-laico/payload-seed
```

## Use

**1. Write seed files.** One default export per collection/global; give each record a
`_key`, and point at other docs / uploads with `ref()` / `asset()`:

```ts
// collections/Services/seed.ts
import { defineSeed } from '@pro-laico/payload-seed'

export default defineSeed('services', ({ asset }) => [
  { _key: 'consulting', title: 'Consulting', slug: 'consulting', image: asset('serviceA') },
])

// collections/Posts/seed.ts
export default defineSeed('posts', ({ ref, asset }) => [
  { _key: 'launch', title: 'We launched', heroImage: asset('post'), relatedService: ref('services', 'consulting') },
])
```

**2. Declare the uploadable assets** (files live in `assets/`):

```ts
// seed/assets.ts
import { defineAssets } from '@pro-laico/payload-seed'

export default defineAssets({
  serviceA: { file: 'service-a.jpg', alt: 'Consulting' },
  post: { file: 'post-cover.jpg', alt: 'Cover' },
})
```

**3. Add the plugin** with your definitions:

```ts
import { seedPlugin } from '@pro-laico/payload-seed'
import services from './collections/Services/seed'
import posts from './collections/Posts/seed'
import assets from './seed/assets'

plugins: [seedPlugin({ definitions: [assets, services, posts], adminButton: true })]
```

**4. Run it.** Set `ENABLE_SEED=true`, then either click **Seed your database** in the admin
header or run `pnpm payload seed`. (The seed is destructive — it clears and recreates the
seeded collections.)

## Typed references

Run `payload generate:types` and the plugin injects a `SeedRegistry` into `payload-types.ts`,
so `ref('services', 'consulting')` is checked against your real `_key`s — rename or remove a
seeded item and every stale reference becomes a TS error. Unknown fields error too. It's
global, no import (like Payload's own generated types).

## Options

| Option | Default | |
| --- | --- | --- |
| `definitions` | — | Your seed definitions (the `seed.ts` default exports). |
| `assets` | `{ dir: 'assets', collection: 'media' }` | Where source files live + the upload collection. |
| `adminButton` | `false` | Show the seed button in the admin header. |

## License

MIT
