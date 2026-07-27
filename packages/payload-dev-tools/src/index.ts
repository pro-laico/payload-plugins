// The plugin (safe to import from payload.config — no next/react-client imports here)
export { default, devToolsPlugin } from './plugin'
export type { EndpointAccess } from './_kit'
export type { DevToolsAccessOptions, DevToolsPluginOptions } from './types'

// The typed view of `config.custom.payloadDevTools`.
export { readDevToolsMarker } from './lib/marker'
export type { PayloadDevToolsMarker } from './types'

// The test harness authoring helper + types. `defineTest` lives here (not just /toolbar) so seed
// scripts, screenshot tooling, and payload-side code can import it without pulling in next.
export { defineTest } from './harness'
export type { Test, TestKind, TestMeta, TestVersion } from './types'

// The cookie names — for custom tooling that stages a version or a location itself.
export { REGION_COOKIE, STAGE_COOKIE } from './cookies'

// The region table. `regionFor` is pure and next-free, so middleware can resolve a geo header with it.
export { DEFAULT_REGIONS, REGIONS, regionFor } from './lib/regions'
export type { ConsentModel, DevRegion, PrivacyRegime } from './types'

// Response shape of `GET /api/dev`, for typed consumers (scripts, agents, custom panels).
export type {
  CollectionCount,
  DatabaseStatus,
  DevSnapshot,
  EnvSnapshot,
  EnvVarStatus,
  FontsSnapshot,
  IconsSnapshot,
  ImagesSnapshot,
  MuxSnapshot,
  SeedSnapshot,
} from './types'
