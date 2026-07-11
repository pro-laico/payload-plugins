export interface DevToolsPluginOptions {
  /**
   * When set, forces the endpoints on or off regardless of environment. By default everything is
   * live only when `NODE_ENV === 'development'` — the endpoints 404 and the toolbar renders
   * nothing anywhere else. Only force `true` on a deployment you'd hand a teammate anyway (a
   * preview env): the snapshot exposes collection counts and config details, unauthenticated.
   */
  enabled?: boolean
  /**
   * Where the host app mounts the dev pages (the `createDevPage` catch-all). Drives the toolbar's
   * built-in link and the browser redirect from `GET /api/dev`. @default '/dev'
   */
  devRoute?: string
}
