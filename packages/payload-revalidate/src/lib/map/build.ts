import type { CollectionConfig, GlobalConfig } from 'payload'

import { buildReferenceGraph } from '../graph/referenceGraph'
import { topLevelFieldNames } from '../fields'
import { resolveCollectionSettings, resolveOptions } from '../options'
import type { PayloadRevalidateMarker, RevalidateInspection, RevalidatePluginOptions } from '../../types'

/** The config shape {@link buildStaticInspection} needs — a SanitizedConfig satisfies it,
 *  but so does any `{ collections, globals }` subset (for tests). */
export interface MapConfigSource {
  collections?: CollectionConfig[]
  globals?: GlobalConfig[]
  blocks?: Parameters<typeof buildReferenceGraph>[0]['blocks']
  custom?: Record<string, unknown>
}

/**
 * Build a {@link RevalidateInspection} purely from a Payload config — no booted server, no
 * DB, no live observation. This is what the `payload-revalidate-map` CLI renders: the
 * static half of the map endpoint (graph + resolved per-collection settings + rules),
 * with `reads`/`events`/`getters` empty because nothing has materialized.
 *
 * Plugin options come from `config.custom.payloadRevalidate.options` (the marker the plugin
 * factory stamps) so the map reflects the app's ACTUAL configuration — prefix, opt-outs,
 * rules — unless `optionsOverride` is passed. Falls back to defaults when the marker is
 * absent (plugin not installed, or an older version).
 */
export function buildStaticInspection(config: MapConfigSource, optionsOverride?: RevalidatePluginOptions): RevalidateInspection {
  const marker = (config.custom as { payloadRevalidate?: PayloadRevalidateMarker } | undefined)?.payloadRevalidate
  const resolved = resolveOptions(optionsOverride ?? marker?.options ?? {})

  const collections = (config.collections ?? []).filter((c) => !c.slug.startsWith('payload-'))
  const built = buildReferenceGraph({ collections, globals: config.globals, blocks: config.blocks })
  // Drop edges into filtered-out nodes so the graph only references listed collections/globals.
  const known = new Set<string>([...built.collections, ...built.globals, '*'])
  const graph = { ...built, edges: built.edges.filter((e) => known.has(e.from) && known.has(e.to)) }

  const settings: RevalidateInspection['settings'] = {}
  for (const collection of collections) {
    const s = resolveCollectionSettings(collection, resolved)
    if (s) settings[collection.slug] = { ...s, fields: topLevelFieldNames(collection.fields) }
  }

  return {
    graph,
    prefix: resolved.prefix,
    observing: false,
    rules: resolved.rules,
    settings,
    getters: [],
    reads: [],
    events: [],
  }
}
