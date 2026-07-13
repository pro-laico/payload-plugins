import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { CollectionConfig, Config, GlobalConfig, Plugin } from 'payload'

import { createMapEndpoints, MAP_ENDPOINT_PATH } from './endpoints/map'
import { buildReferenceGraph } from './lib/graph/referenceGraph'
import { createAfterChange } from './hooks/collection/afterChange'
import { createAfterDelete } from './hooks/collection/afterDelete'
import { createGlobalAfterChange } from './hooks/global/afterChange'
import { changeDetectionFields, topLevelFieldNames } from './lib/fields'
import { peekConfig, stashConfig } from './lib/configStash'
import { collectJoinMembership } from './lib/diff/joins'
import { stashInspect } from './lib/inspect'
import { getObservations } from './lib/observe/registry'
import { globalEnabled, resolveCollectionSettings, resolveOptions } from './lib/options'
import { scanGettersLive } from './lib/scan/live'
import { registerSeedListener } from './lib/seed/afterSeed'
import { stashState } from './lib/state'
import type { PayloadRevalidateMarker, ReferenceGraph, RevalidatePluginOptions } from './types'

/** Absolute path to a bundled bin script, resolving the src→dist swap from this module's
 *  own location (so `payload <key>` works both in-workspace and when published). */
function binScriptPath(name: string): string {
  const here = fileURLToPath(import.meta.url)
  const ext = here.endsWith('.ts') ? 'ts' : 'js'
  return resolve(dirname(here), 'bin', `${name}.${ext}`)
}

/**
 * Payload plugin that owns Next.js tag-based cache revalidation, surgically:
 *
 * - **Write side (automatic)** — every collection and global gets afterChange/afterDelete
 *   hooks that bust exactly the tags a change touches: the doc's tags always, the list
 *   tag only when list surfaces could actually change (create / delete / publish /
 *   unpublish / alias or `listFields` change), draft saves only the draft lane. Honors
 *   `context.disableRevalidate`.
 * - **Read side (one helper call)** — getters written with Next 16 `'use cache'` call
 *   `cacheDoc` / `cacheList` / `cacheGlobal` from `@pro-laico/payload-revalidate/cache`,
 *   which apply the canonical tags AND walk the fetched value to tag every embedded doc —
 *   so "update image 123" purges precisely the entries that render it.
 * - **Visibility** — a static reference graph (what CAN revalidate what) plus dev-time
 *   observation of materialized reads and bust events, served at `GET /api/revalidate-map`
 *   and rendered by `@pro-laico/payload-dev-tools` at `/dev/revalidate`.
 * - **Seed integration** — registers an after-seed listener `@pro-laico/payload-seed`
 *   invokes at the end of a run, flushing the seeded surface once (seed writes themselves
 *   stay hook-quiet via `context.disableRevalidate`).
 *
 * Add it LAST in the plugins array so collections other plugins contribute get hooks too.
 *
 * @example
 * ```ts
 * import { buildConfig } from 'payload'
 * import { revalidatePlugin } from '@pro-laico/payload-revalidate'
 *
 * export default buildConfig({ plugins: [seedPlugin(), iconsPlugin(), revalidatePlugin()] })
 * ```
 */
export const revalidatePlugin =
  (opts: RevalidatePluginOptions = {}): Plugin =>
  (config: Config): Config => {
    const resolved = resolveOptions(opts)
    if (!resolved.enabled) return config

    // Index joins by CHILD collection so a write can bust the parent memberships it moves.
    // Built from the pre-boot config (same order caveat as the hooks — the onInit warning
    // covers late-registered collections).
    const joinIndex = collectJoinMembership(config.collections)

    const settingsBySlug: Record<string, ReturnType<typeof resolveCollectionSettings> & object> = {}
    const optedOut = new Set<string>()
    const collections = (config.collections ?? []).map((collection): CollectionConfig => {
      const settings = resolveCollectionSettings(collection, resolved)
      if (!settings) {
        optedOut.add(collection.slug)
        return collection
      }
      settingsBySlug[collection.slug] = settings
      const { relations, joins } = changeDetectionFields(collection.fields)
      const input = {
        slug: collection.slug,
        settings,
        rules: resolved.rules,
        diffSchema: { relationFields: relations, ignoreFields: joins },
        joinRules: joinIndex[collection.slug] ?? [],
      }
      return {
        ...collection,
        hooks: {
          ...collection.hooks,
          afterChange: [...(collection.hooks?.afterChange ?? []), createAfterChange(input)],
          afterDelete: [...(collection.hooks?.afterDelete ?? []), createAfterDelete(input)],
        },
      }
    })

    // Stash at config-build time so the tag builders, the observer gate, and cacheIds'
    // declared-scope check work in any process that loaded the config.
    stashState({
      prefix: resolved.prefix,
      observe: resolved.observe,
      lists: Object.fromEntries(Object.entries(settingsBySlug).map(([slug, s]) => [slug, Object.keys(s.lists)])),
      extraTags: Object.fromEntries(Object.entries(settingsBySlug).map(([slug, s]) => [slug, s.extraTags])),
      rules: resolved.rules,
    })
    registerSeedListener()

    const globals = (config.globals ?? []).map((global): GlobalConfig => {
      if (!globalEnabled(global, resolved)) return global
      return {
        ...global,
        hooks: { ...global.hooks, afterChange: [...(global.hooks?.afterChange ?? []), createGlobalAfterChange(global.slug)] },
      }
    })

    // The inspection getter behind the map endpoint and the dev-tools view. The graph is
    // built lazily and preferably from the BOOTED config (all plugins applied — this
    // factory only sees collections registered before it in the plugins array), minus
    // Payload's own internal collections (payload-preferences et al), which only add noise.
    let graph: ReferenceGraph | null = null
    let graphFromBootedConfig = false
    stashInspect(() => {
      const booted = peekConfig() as Parameters<typeof buildReferenceGraph>[0] | undefined
      if (!graph || (!graphFromBootedConfig && booted)) {
        graphFromBootedConfig = Boolean(booted)
        const source = booted ?? { collections, globals, blocks: config.blocks }
        const built = buildReferenceGraph({ ...source, collections: (source.collections ?? []).filter((c) => !c.slug.startsWith('payload-')) })
        // Drop edges into filtered-out nodes (e.g. the `folder` relationship Payload
        // injects → `payload-folders`): the dev-tools graph only renders listed nodes,
        // and React Flow discards dangling edges with console errors.
        const known = new Set([...built.collections, ...built.globals, '*'])
        graph = { ...built, edges: built.edges.filter((edge) => known.has(edge.from) && known.has(edge.to)) }
      }
      const settings = Object.fromEntries(
        Object.entries(settingsBySlug).map(([slug, s]) => [
          slug,
          { ...s, fields: topLevelFieldNames((config.collections ?? []).find((c) => c.slug === slug)?.fields) },
        ]),
      )
      return {
        graph,
        prefix: resolved.prefix,
        observing: resolved.observe,
        rules: resolved.rules,
        settings,
        // Live source scan (the payload-icons pattern): what the CODE declares, before
        // anything materializes. Dev-only — production has no source on disk.
        getters: resolved.observe ? scanGettersLive() : [],
        ...getObservations(),
      }
    })

    const marker: PayloadRevalidateMarker = { options: opts, endpointPath: resolved.endpoint ? `/api${MAP_ENDPOINT_PATH}` : null }

    return {
      ...config,
      collections,
      globals,
      // `payload revalidate-map` — dump the dependency map as Markdown/JSON from the config,
      // no server booted (Payload's CLI loads the config and calls the script with it).
      bin: [...(config.bin ?? []), { key: 'revalidate-map', scriptPath: binScriptPath('revalidateMap') }],
      endpoints: resolved.endpoint ? [...(config.endpoints ?? []), ...createMapEndpoints({ observe: resolved.observe })] : config.endpoints,
      // Data-only discovery marker for decoupled tooling (dev-tools) — see PayloadRevalidateMarker.
      custom: { ...config.custom, payloadRevalidate: marker },
      onInit: async (payload) => {
        await config.onInit?.(payload)
        // Remember the app's config so the `./cache` helpers resolve it from globalThis —
        // no `@payload-config` alias (and thus no transpilePackages) required once booted.
        stashConfig(payload.config)
        // Order guard: this factory can only hook collections/globals that existed when it
        // ran. Anything a LATER plugin contributed is silently unhooked — tagged reads
        // (e.g. payload-icons' shared tag) would never bust. Say so loudly at boot.
        const lateCollections = payload.config.collections
          .map((c) => c.slug)
          .filter((slug) => !settingsBySlug[slug] && !optedOut.has(slug) && !slug.startsWith('payload-'))
        const hookedGlobals = new Set(globals.map((g) => g.slug))
        const lateGlobals = payload.config.globals.map((g) => g.slug).filter((slug) => !hookedGlobals.has(slug))
        if (lateCollections.length || lateGlobals.length)
          console.warn(
            `[payload-revalidate] registered AFTER revalidatePlugin() and NOT hooked for revalidation: ${[...lateCollections, ...lateGlobals.map((slug) => `global:${slug}`)].join(', ')} — move revalidatePlugin() LAST in the plugins array.`,
          )
      },
    }
  }

export default revalidatePlugin
