/**
 * The single synthetic cache tag the icons surface lives under when
 * `@pro-laico/payload-revalidate` is installed. Two decoupled halves meet on this string:
 *
 * - **Write side** — the `icon` and `iconSet` collections carry it in their
 *   `custom.revalidate.extraTags` marker, so revalidatePlugin's auto-attached hooks bust
 *   it on every published icon/set write and delete (no import of the revalidate package).
 * - **Read side** — `getIconSvg` applies it via `cacheTag` whenever it runs inside a
 *   consumer's `'use cache'` scope (and the revalidate plugin is detected), so a page that
 *   bakes rendered SVGs into its cache entry refreshes when icons change.
 *
 * One coarse tag on purpose: the active-set read isn't keyed by a doc id (it queries
 * `active: true`), icon writes are rare, and the whole surface re-materializes in one
 * query — per-doc granularity would buy nothing.
 *
 * Deliberately NOT prefixed with the revalidate plugin's `prefix` option: `extraTags` are
 * busted verbatim, so the read side must apply the identical verbatim string.
 */
export const ICONS_REVALIDATE_TAG = 'payload-icons'
