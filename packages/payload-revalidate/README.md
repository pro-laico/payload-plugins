# @pro-laico/payload-revalidate

Atomic Next.js cache revalidation for Payload CMS (App Router, Cache Components):
id-keyed cache entries, field-driven busts that touch exactly what a change means, and
a live dependency map showing what revalidates when.

- **Field-driven write side** — `revalidatePlugin()` hooks every collection/global; doc
  tags always, scoped list tags only when a scope's declared fields (or membership)
  change, draft saves only the draft lane, `context.disableRevalidate` honored.
- **Join-aware** — a `join` field is a live query, not a stable reference, so
  create/delete/reassign of a member surgically busts only the affected parent's membership
  (`{child}:join:{on}:{parentId}`) — the parent whose "all my posts" list actually moved,
  never the others.
- **Atomic read side** — inside your `'use cache'` getters, one finder call fetches AND
  tags: `findDoc` / `findDocByID` (one doc = one entry, id-keyed, shared by every usage
  site), `findIds` (lists cache ids only — `select: {}` forced — with declared scopes
  like `posts:list:featured`), `findGlobal`. Atomic defaults baked in (`depth: 0`,
  errors → `null`), full local-API passthrough, returns typed
  from your generated `payload-types`, and `user`/`req` refused (a shared cache entry
  must not hold a requester-scoped read). Access is left to Payload's own default
  (`overrideAccess: true`) — pass `overrideAccess: false` to scope a read to what an
  anonymous visitor may see. References stay ids — "edit image 123 → only
  its own entry re-materializes, everywhere it's used." The low-level `cacheDoc` /
  `cacheIds` / `cacheGlobal` primitives stay exported for getters the finders can't
  express.
- **Visibility** — a schema-derived reference graph + observed reads + a bust-event log
  at `GET /api/revalidate-map`, rendered by `@pro-laico/payload-dev-tools` at
  `/dev/revalidate`, or dumped as a Markdown doc with `payload revalidate-map`.
- **Seed integration** — one precise flush at the end of a `@pro-laico/payload-seed` run.

```ts
// payload.config.ts — add it LAST so plugin-contributed collections get hooks too
plugins: [seedPlugin(), revalidatePlugin()]
```

```ts
// lib/cache.ts — seed the read helpers ONCE with your app's live Payload session
import config from '@payload-config'
import { createCacheHelpers } from '@pro-laico/payload-revalidate/cache'
import { getPayload } from 'payload'

export const { findDoc, findDocByID, findIds, findGlobal } = createCacheHelpers(getPayload({ config }))
```

```ts
// getters — 'use cache' + one finder call each
import { findDoc, findIds } from '@/lib/cache'

export async function getPost(slug: string) {
  'use cache'
  return findDoc('posts', { where: { slug: { equals: slug } }, as: slug })
}

export async function getRecentPostIds() {
  'use cache'
  return (await findIds('posts', { sort: '-publishedAt', limit: 12, list: 'recent' })).ids
}
```

The package never resolves Payload or your config itself — no globalThis stashes, no
`@payload-config` alias tricks, no `transpilePackages` requirement. The handle you seed is
the session that tags every read.

Requires `next >= 16` with `cacheComponents: true`.

## Map CLI

The plugin registers a `payload revalidate-map` command (Payload custom bin — no package
path, no runner script). It prints the project's cache dependency map — tag vocabulary,
per-collection blast radius, the full reference graph — as a Markdown doc straight from the
config, no server booted. Handy for a `REVALIDATION.md` in the repo, or as context for an AI
working in the project.

```sh
payload revalidate-map > REVALIDATION.md
payload revalidate-map --json --out revalidate-map.json   # raw inspection JSON
```

It reads `config.custom.payloadRevalidate.options`, so the output reflects the app's real
prefix, opt-outs, and rules. Programmatic equivalent: `renderRevalidateMap(buildStaticInspection(config))`.

**[Documentation →](https://payload-plugins.prolaico.com/docs/plugins/payload-revalidate)** ·
Example app: [`examples/revalidate-sandbox`](https://github.com/pro-laico/payload-plugins/tree/main/examples/revalidate-sandbox)

MIT — not affiliated with Payload CMS.
