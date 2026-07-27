import type { EndpointAccess } from '../../_kit'

export interface DevToolsPluginOptions {
  /** Force the toolbar and dev endpoints on or off. Default: `NODE_ENV === 'development'`; when off, nothing is registered. */
  enabled?: boolean
  /** Everything else.
   *
   * - `devRoute`
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
  /** Per-endpoint gates for the plugin's HTTP endpoints.
   *
   * - `dev` — all `/dev*` endpoints; defaults to public (they only register in development) */
  access?: DevToolsAccessOptions
}

/** `DevToolsPluginOptions` with the defaults applied — same keys, same nesting. */
export interface ResolvedDevToolsOptions {
  enabled: boolean
  options: { devRoute: string; access: { dev: EndpointAccess | undefined } }
}
