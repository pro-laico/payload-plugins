/**
 * A collection's `custom.seedAsset` marker: declares a collection whose `_file` bytes are ingested
 * by the collection's own hook rather than stored as a Payload upload — e.g. `@pro-laico/payload-mux`'s
 * `mux-video` (uploaded to Mux). Set on the collection config:
 *
 *   { slug: 'mux-video', custom: { seedAsset: { sourceField: 'source' } }, ... }
 *
 * Instead of uploading bytes, the seed engine resolves the `_file` under `subdir` and sets it as
 * `{ file, ...options }` on the doc's `sourceField`, for the collection's ingest hook to consume.
 * `true` is shorthand for the defaults (`sourceField: 'source'`, `subdir`: the collection slug).
 * Plain config — no import of the seed package needed, so the owning plugin stays decoupled from it.
 */
export type SeedAssetMarker =
  | true
  | {
      /** Doc field the engine sets to `{ file, ...options }` for the ingest hook. @default 'source' */
      sourceField?: string
      /** Subdirectory under the assets dir holding the source files. @default the collection slug */
      subdir?: string
    }

/**
 * A collection's `custom.seedDisabled` marker: declares that the collection cannot be seeded right
 * now (typically missing credentials), set by the owning plugin from its own config/env:
 *
 *   { slug: 'mux-video', custom: { seedDisabled: 'Mux credentials not set (MUX_TOKEN_ID / MUX_TOKEN_SECRET)' } }
 *
 * The engine skips the collection's definition at runtime with a warning (a string is used as the
 * reason) and drops any optional field whose `ref()` points at it — a required ref is a hard error.
 * Because the definition stays registered, the generated seed-ref types don't change with the
 * environment; set the env vars and the next run seeds it, nothing else to touch. Plain config —
 * no import of the seed package needed, so the owning plugin stays decoupled from it.
 */
export type SeedDisabledMarker = boolean | string
