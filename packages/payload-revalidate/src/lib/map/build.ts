import type { CollectionConfig, GlobalConfig } from 'payload'

import { topLevelFieldNames } from '../fields'
import { buildReferenceGraph } from '../graph/referenceGraph'
import { resolveCollectionSettings, resolveOptions } from '../options'
import type { PayloadRevalidateMarker, RevalidateInspection, RevalidatePluginOptions } from '../../types'

export interface MapConfigSource {
  collections?: CollectionConfig[]
  globals?: GlobalConfig[]
  blocks?: Parameters<typeof buildReferenceGraph>[0]['blocks']
  custom?: Record<string, unknown>
}

export function buildStaticInspection(config: MapConfigSource, optionsOverride?: RevalidatePluginOptions): RevalidateInspection {
  //TODO: replace `as` cast with proper typing
  const marker = (config.custom as { payloadRevalidate?: PayloadRevalidateMarker } | undefined)?.payloadRevalidate
  const resolved = resolveOptions(optionsOverride ?? marker?.options ?? {})

  const collections = (config.collections ?? []).filter((c) => !c.slug.startsWith('payload-'))
  const built = buildReferenceGraph({ collections, globals: config.globals, blocks: config.blocks })
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
