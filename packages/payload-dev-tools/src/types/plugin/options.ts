export interface DevToolsPluginOptions {
  /** Defaults to `NODE_ENV === 'development'` — the dev endpoints are not registered at all when off. */
  enabled?: boolean
  devRoute?: string
}

export interface ResolvedDevToolsOptions {
  enabled: boolean
  devRoute: string
}
