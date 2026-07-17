export interface DevToolsPluginOptions {
  /** Force the toolbar and dev endpoints on or off. Default: `NODE_ENV === 'development'`; when off, nothing is registered. */
  enabled?: boolean
  /** Where the app mounts the `createDevPage` catch-all. Default `'/dev'`. */
  devRoute?: string
}

export interface ResolvedDevToolsOptions {
  enabled: boolean
  devRoute: string
}
