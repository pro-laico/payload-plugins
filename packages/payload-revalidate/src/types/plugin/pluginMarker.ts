import type { RevalidatePluginOptions } from './pluginOptions'

/**
 * The `config.custom.payloadRevalidate` discovery marker — how decoupled tooling
 * (e.g. `@pro-laico/payload-dev-tools`) detects the plugin and finds its endpoint from
 * just `payload.config`, no import. Data-only; live inspection goes through the
 * `Symbol.for('pro-laico.payload-revalidate.inspect')` globalThis slot instead
 * (functions don't belong on `custom` — it feeds the serialized client config).
 */
export interface PayloadRevalidateMarker {
  options: RevalidatePluginOptions
  /** Where `GET`/`POST /api{endpointPath}` serves the map, or `null` when disabled. */
  endpointPath: string | null
}
