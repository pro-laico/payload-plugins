# failure-lab

A sandbox **designed to error**. Every config in here is a deliberate trap, and the specs drive the
real plugins (real Payload, throwaway SQLite, no Next server) down their failure paths on purpose —
because we normally only test success, and "it'll error and catch this" is an assumption until
something actually exercises it.

Each test asserts two things:

1. **The failure fires** — the expected error class / status / warning actually happens.
2. **The story is legible** — the message names the thing that failed (seed node `collection:_key`,
   doc title/filename, offending field, endpoint id) and the underlying cause. Never a bare
   generated id.

## Run it

```bash
pnpm --filter failure-lab test
```

Each spec ends with a printed **legibility report** — every captured error/warning under its
scenario banner — so a test run doubles as an eyeball pass over the actual message text.

## Coverage by plugin

| Spec | Plugin | What's exercised |
| --- | --- | --- |
| `tests/seed.int.spec.ts` | payload-seed | validation (unknown slugs, bad refs, dup keys, misplaced `_file` — all collected in one throw), skips (`custom.seedDisabled`, required-ref-to-skipped, no definitions), required-only ref cycles, missing `_file`, create/deferred/global write failures (`SeedRunError`), un-clearable docs (partial wipe with human label) |
| `tests/images.int.spec.ts` | payload-images | boot guards (`extendCollection`/`sourceSlug` misconfig → thrown), boot warnings (`img` slug shadowing), transform endpoint 400/404, missing source bytes (502), corrupt source bytes (500) — clients get terse bodies by design; the diagnosis (id + filename + cause) is asserted in the LOG. Purge 401/400 |
| `tests/fonts.int.spec.ts` | payload-fonts | typeface validation APIErrors (no files, shared original *naming the owning typeface*, duplicate weight+style), byte-sniffed MIME rejection, and the optimize-hook warn paths — corrupt bytes / missing file, where the SAVE SUCCEEDS and an id-only warn is the only signal |
| `tests/icons.int.spec.ts` | payload-icons | broken SVG (saves with an `optimized` failure report and NO `svgString` — will never render), stroke-based warning, transform/clip-path skip, malicious SVG (sanitized silently, by design), MIME rejection, icon-name miss diagnosis (`no active icon set — activate one`) |
| `tests/revalidate.int.spec.ts` | payload-revalidate | write hooks outside a request scope (write SUCCEEDS, one dev warn naming the tag, event still recorded on the map), cache-helper misuse advisories (cacheTag outside `'use cache'`, baked-in populated docs with path → tag provenance, capped walk = under-tag risk, content-carrying `cacheIds`, undeclared list scope with the exact declare-it snippet), config unreachable (`getPayloadClient` two-fix diagnosis, getter degrades to static tags), map endpoint 400/404/503 |
| `tests/mux.int.spec.ts` | payload-mux | boot without credentials (console.warn + `custom.seedDisabled` marker), `extendCollection` guard, creates that would call Mux (fail fast offline — the ingest path surfaces the RAW SDK auth error with zero plugin context: a known gap), upload endpoint 403/400/500, webhook bad-signature 401 with actionable hint, signed `video.asset.errored` event landing Mux's message on the doc |

payload-dev-tools is intentionally absent: its failure surface (dev-gate 404s, thin 400/500 JSON
bodies) is already covered by unit tests in the package itself, and its only legibility-sensitive
path needs a Next render context.

## How failures are triggered

- **Data-driven traps** — magic values (`status: 'boom'`) rejected by field `validate` functions
  (`src/payload.config.ts`, the seed lab's trap config).
- **Runtime switches** — `src/flags.ts` mutable flags checked by hooks (`lockMediaDeletes`,
  `failThingUpdates`), so tests trigger write failures deterministically.
- **Disk-level corruption** — upload real bytes, then overwrite/delete the stored file before the
  hook or endpoint reads it back (fonts optimize, images transform). Payload sniffs upload buffers
  against MIME allowlists, so garbage can't be uploaded directly.
- **Absent credentials/config** — mux boots with no `MUX_*` env; icons resolves names with no
  active set; images points `extendCollection` at nothing.
- **Synthetic requests** — endpoint handlers are plain functions pulled off
  `payload.config.endpoints` and called with hand-built requests (including self-HMAC'd Mux
  webhook events). No HTTP server anywhere.

## Harness notes (src/)

- `boot.ts` — boots an isolated instance per scenario: unique temp SQLite file (`:memory:` is
  shared per-process by libsql — a second boot's push wipes the first), and a unique `getPayload`
  **key** (without it, a second boot returns the FIRST cached instance: its `onInit` never runs and
  cleaning it up destroys the shared adapter). `expectBootError` drives config-time throws.
- `logCapture.ts` — in-memory pino destination wired into every config's `logger`; specs assert on
  `warnMessages()` / level-50 entries. Config-time `console.warn`s (mux) need a spy instead.
- `stubs/server-only.ts` — vitest alias target; the real `server-only` module throws outside an
  RSC bundle.
- Specs are file-isolated (fresh module registry per file), so once-per-process warn latches and
  plugin `globalThis` stashes don't leak between plugins.

## Adding a scenario

When a new failure path lands in a plugin, add the trap here (a field, a flag, a config, or a
corrupted file) plus one test asserting the error is identifiable. If a message ever regresses to
an opaque id — or a failure goes silent — this suite is what catches it.
