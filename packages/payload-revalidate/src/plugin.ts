import type { CollectionConfig, Config, GlobalConfig, Plugin, SanitizedConfig } from 'payload'

import { createTags } from './lib/tags'
import { binScriptPath } from './_kit'
import { stashInspect } from './lib/inspect'
import { scanGettersLive } from './lib/scan/live'
import { collectJoinMembership } from './lib/diff/joins'
import { getObservations } from './lib/observe/registry'
import { registerSeedListener } from './lib/seed/afterSeed'
import { buildReferenceGraph } from './lib/graph/referenceGraph'
import { createAfterChange } from './hooks/collection/afterChange'
import { createAfterDelete } from './hooks/collection/afterDelete'
import { createGlobalAfterChange } from './hooks/global/afterChange'
import { createMapEndpoints, MAP_ENDPOINT_PATH } from './endpoints/map'
import { changeDetectionFields, topLevelFieldNames } from './lib/fields'
import { globalEnabled, resolveCollectionSettings, resolveOptions } from './options'
import type { PayloadRevalidateMarker, ReferenceGraph, RevalidatePluginOptions } from './types'

/** Atomic Next.js cache revalidation: edit one document and only the pages that show it go
 * stale. Field-driven busts, id-keyed cache entries, and a live dependency map.
 *
 * - `enabled`
 * - `collections`
 * - `globals`
 * - `options`
 */
export const revalidatePlugin =
  (opts: RevalidatePluginOptions = {}): Plugin =>
  (config: Config): Config => {
    const resolved = resolveOptions(opts)
    if (!resolved.enabled) return config

    const optedOut = new Set<string>()
    const tagBuilders = createTags(resolved.options.prefix)
    const joinIndex = collectJoinMembership(config.collections)
    const settingsBySlug: Record<string, ReturnType<typeof resolveCollectionSettings> & object> = {}
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
        rules: resolved.options.rules,
        tags: tagBuilders,
        observe: resolved.options.observe,
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

    const extraTags = Object.fromEntries(Object.entries(settingsBySlug).map(([slug, s]) => [slug, s.extraTags]))
    const lists = Object.fromEntries(Object.entries(settingsBySlug).map(([slug, s]) => [slug, Object.keys(s.lists)]))
    registerSeedListener({ tags: tagBuilders, lists, extraTags, rules: resolved.options.rules, observe: resolved.options.observe })

    const globals = (config.globals ?? []).map((global): GlobalConfig => {
      if (!globalEnabled(global, resolved)) return global
      const hook = createGlobalAfterChange(global.slug, { tags: tagBuilders, observe: resolved.options.observe })
      return { ...global, hooks: { ...global.hooks, afterChange: [...(global.hooks?.afterChange ?? []), hook] } }
    })

    let graphFromBootedConfig = false
    let graph: ReferenceGraph | null = null
    let bootedConfig: SanitizedConfig | null = null
    stashInspect(() => {
      const booted = bootedConfig ?? undefined
      if (!graph || (!graphFromBootedConfig && booted)) {
        graphFromBootedConfig = Boolean(booted)
        const source = booted ?? { collections, globals, blocks: config.blocks }
        const built = buildReferenceGraph({ ...source, collections: (source.collections ?? []).filter((c) => !c.slug.startsWith('payload-')) })
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
        prefix: resolved.options.prefix,
        observing: resolved.options.observe,
        rules: resolved.options.rules,
        settings,
        getters: resolved.options.observe ? scanGettersLive() : [],
        ...getObservations(),
      }
    })

    const marker: PayloadRevalidateMarker = {
      options: opts,
      endpointPath: resolved.options.observe ? `/api${MAP_ENDPOINT_PATH}` : null,
      prefix: resolved.options.prefix,
      observe: resolved.options.observe,
      lists,
      extraTags,
      rules: resolved.options.rules,
    }

    return {
      ...config,
      collections,
      globals,
      bin: [...(config.bin ?? []), { key: 'revalidate-map', scriptPath: binScriptPath(import.meta.url, 'revalidateMap') }],
      // The map endpoints only ever serve observations, so `observe` alone governs them.
      endpoints: resolved.options.observe ? [...(config.endpoints ?? []), ...createMapEndpoints()] : config.endpoints,
      custom: { ...config.custom, payloadRevalidate: marker },
      onInit: async (payload) => {
        await config.onInit?.(payload)
        bootedConfig = payload.config
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
