import type { Config, Plugin } from 'payload'
import { registerAfterSeedListener } from '@pro-laico/payload-seed'

/** The one tag a sandbox's own reads are cached under.
 *
 * A real app tags per document and per list — that's `@pro-laico/payload-revalidate`, and what the
 * revalidate sandbox is for. A demo whose plugin ships no cached read of its own wants the opposite:
 * the least machinery that is still correct, so the plugin being demoed stays the only thing on
 * screen. One tag, busted by any write.
 *
 * That stops being enough the moment a plugin caches something itself. `payload-icons` does — its
 * `<Icon>` tags its read `payload-icons`, and only revalidatePlugin's write hooks bust that — so
 * icons-sandbox installs the real pair and doesn't use this at all. */
export const SANDBOX_TAG = 'sandbox'

/** `updateTag` first (immediate, same-request), `revalidateTag` otherwise. Both need a Next request
 * scope, so both throw under `payload run seed` — a separate process with no server cache to reach.
 * That's reported once, not thrown: the write itself succeeded. */
const safeRevalidate = async (tag: string): Promise<void> => {
  const mod = await import('next/cache')
  try {
    mod.updateTag(tag)
    return
  } catch {}
  try {
    mod.revalidateTag(tag, 'max')
  } catch {
    console.warn(
      `[sandbox] revalidateTag('${tag}') was a no-op — no Next request scope. Normal for a CLI seed; restart the dev server to see it.`,
    )
  }
}

const bust = async (): Promise<void> => {
  await safeRevalidate(SANDBOX_TAG)
}

/** Busts `SANDBOX_TAG` on every write and at the end of a seed run, so the sandbox pages can cache
 * their reads — and therefore prerender — instead of re-querying on every request.
 *
 * The seed listener is not redundant with the collection hooks: seed writes carry
 * `context.disableRevalidate`, because payload-seed wants one revalidation after the run rather
 * than one per document. `registerAfterSeedListener` is the seam it exposes for exactly that. */
export const sandboxCachePlugin =
  (): Plugin =>
  (config: Config): Config => {
    registerAfterSeedListener('sandbox-cache', bust)

    return {
      ...config,
      collections: (config.collections ?? []).map((collection) => ({
        ...collection,
        hooks: {
          ...collection.hooks,
          afterChange: [...(collection.hooks?.afterChange ?? []), bust],
          afterDelete: [...(collection.hooks?.afterDelete ?? []), bust],
        },
      })),
      globals: (config.globals ?? []).map((global) => ({
        ...global,
        hooks: { ...global.hooks, afterChange: [...(global.hooks?.afterChange ?? []), bust] },
      })),
    }
  }
