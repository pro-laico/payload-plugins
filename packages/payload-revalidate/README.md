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
- **Atomic read side** — inside your `'use cache'` getters: `cacheDoc` (one doc = one
  entry, id-keyed, shared by every usage site), `cacheIds` (lists cache ids only, with
  declared scopes like `posts:list:featured`), `cacheGlobal`. References stay ids —
  "edit image 123 → only its own entry re-materializes, everywhere it's used." Baked-in
  populated content is still tagged for correctness and flagged in dev as a refactor
  candidate.
- **Visibility** — a schema-derived reference graph + observed reads + a bust-event log
  at `GET /api/revalidate-map`, rendered by `@pro-laico/payload-dev-tools` at
  `/dev/revalidate`, or dumped as a Markdown doc with `payload revalidate-map`.
- **Seed integration** — one precise flush at the end of a `@pro-laico/payload-seed` run.

```ts
// payload.config.ts — add it LAST so plugin-contributed collections get hooks too
plugins: [seedPlugin(), revalidatePlugin()]
```

```ts
// a getter
import { cacheDoc, getPayloadClient } from '@pro-laico/payload-revalidate/cache'

export async function getPost(slug: string) {
  'use cache'
  const payload = await getPayloadClient()
  const res = await payload.find({ collection: 'posts', where: { slug: { equals: slug } }, limit: 1, depth: 2 })
  return cacheDoc(res.docs[0] ?? null, 'posts', { as: slug })
}
```

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
