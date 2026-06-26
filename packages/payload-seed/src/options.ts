import type { PayloadRequest } from 'payload'

/**
 * Authorization predicate run after the auth check; receives the authenticated user and
 * returns whether the seed (a destructive, full-DB operation) is permitted. Defaults to
 * "any authenticated user" — pass a stricter check (e.g. a role test) in production.
 */
export type SeedAuthorize = (user: NonNullable<PayloadRequest['user']>) => boolean | Promise<boolean>

export interface GraphOptions {
  /** Where to write the dependency artifact. `graph.html` (Mermaid) + a sibling
   *  `graph.json` are emitted next to this path. Default: `.seed/graph.html`. */
  output?: string
  /** Also write the JSON sidecar. Default: true. */
  json?: boolean
}

export interface AssetOptions {
  /** Root directory holding source assets, organized as `image/`, `svg/`, `font/`.
   *  Default: `assets`. */
  dir?: string
  /** Default upload collection for assets that don't set their own. Default: `media`. */
  collection?: string
}

export interface SeedPluginOptions {
  /**
   * Whether the seed endpoint is registered at all. This is separate from the
   * `ENABLE_SEED` runtime guard: set it from your own env so a production build can omit
   * the endpoint entirely. Default: true.
   */
  enabled?: boolean
  /** Glob(s), relative to cwd, for auto-discovering seed files. Default: `['**\/seed.ts']`
   *  (excluding node_modules / dist / .next). */
  discover?: string | string[]
  /** Media registry config. */
  assets?: AssetOptions
  /** Endpoint path (resolves under `/api`). Default: `/seed`. */
  endpoint?: string
  /** Restrict who may trigger the endpoint. Default: any authenticated user. */
  authorize?: SeedAuthorize
  /** Dependency graph artifact. Set `false` to disable. Default: enabled at `.seed/graph.html`. */
  graph?: GraphOptions | false
  /** Inject the admin SeedButton on the dashboard. Default: false. */
  adminButton?: boolean
}

/** Options with defaults applied. */
export interface ResolvedSeedOptions {
  enabled: boolean
  discover: string[]
  assetsDir: string
  assetsCollection: string
  endpoint: string
  authorize?: SeedAuthorize
  graph: Required<GraphOptions> | false
  adminButton: boolean
}

const DEFAULT_DISCOVER = ['**/seed.ts']
const DEFAULT_GRAPH: Required<GraphOptions> = { output: '.seed/graph.html', json: true }

export function resolveOptions(options: SeedPluginOptions = {}): ResolvedSeedOptions {
  const graph = options.graph === false ? false : { ...DEFAULT_GRAPH, ...options.graph }
  return {
    enabled: options.enabled ?? true,
    discover: typeof options.discover === 'string' ? [options.discover] : (options.discover ?? DEFAULT_DISCOVER),
    assetsDir: options.assets?.dir ?? 'assets',
    assetsCollection: options.assets?.collection ?? 'media',
    endpoint: options.endpoint ?? '/seed',
    authorize: options.authorize,
    graph,
    adminButton: options.adminButton ?? false,
  }
}
