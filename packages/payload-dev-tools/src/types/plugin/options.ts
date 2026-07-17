export interface DevToolsPluginOptions {
  /** Force the toolbar and dev endpoints on or off. Default: `NODE_ENV === 'development'`; when off, nothing is registered. */
  enabled?: boolean
  /** Everything else.
   *
   * - `devRoute` */
  options?: DevToolsOptions
}

export interface DevToolsOptions {
  /** Where the app mounts the `createDevPage` catch-all. Default `'/dev'`. */
  devRoute?: string
}

/** `DevToolsPluginOptions` with the defaults applied — same keys, same nesting. */
export interface ResolvedDevToolsOptions {
  enabled: boolean
  options: { devRoute: string }
}
