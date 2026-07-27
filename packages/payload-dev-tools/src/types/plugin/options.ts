import type { EndpointAccess } from '../../_kit'
import type { DevRegion } from '../region'

export interface DevToolsPluginOptions {
  /** Force the toolbar and dev endpoints on or off. Default: `NODE_ENV === 'development'`; when off, nothing is registered. */
  enabled?: boolean
  /** Everything else.
   *
   * - `devRoute`
   * - `regions`
   * - `access` */
  options?: DevToolsOptions
}

export interface DevToolsAccessOptions {
  /** Gates all `/dev*` endpoints. Defaults to public (they only register in development). */
  dev?: EndpointAccess
}

export interface DevToolsOptions {
  /** Where the app mounts the `createDevPage` catch-all. Default `'/dev'`. */
  devRoute?: string
  /** The locations the toolbar's Region toggle offers, and the regime each one implies. Defaults to
   * one region per distinct behaviour (`DEFAULT_REGIONS`). Entries here also win over the built-in
   * lookup table, so this is where you correct or add a region. */
  regions?: DevRegion[]
  /** Per-endpoint gates for the plugin's HTTP endpoints.
   *
   * - `dev` — all `/dev*` endpoints; defaults to public (they only register in development) */
  access?: DevToolsAccessOptions
}

/** `DevToolsPluginOptions` with the defaults applied — same keys, same nesting. */
export interface ResolvedDevToolsOptions {
  enabled: boolean
  options: { devRoute: string; regions: DevRegion[]; access: { dev: EndpointAccess | undefined } }
}
