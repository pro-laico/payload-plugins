// The plugin (safe to import from payload.config — no next/react-client imports here)
export { default, devToolsPlugin } from './plugin'
export type { DevToolsPluginOptions } from './options'

// The test harness authoring helper + types. `defineTest` lives here (not just /toolbar) so seed
// scripts, screenshot tooling, and payload-side code can import it without pulling in next.
export { defineTest } from './harness'
export type { Test, TestKind, TestMeta, TestVersion } from './harness'

// The stage cookie name — for custom tooling that stages a version itself.
export { STAGE_COOKIE } from './cookies'

// Response shape of `GET /api/dev`, for typed consumers (scripts, agents, custom panels).
export type {
  CollectionCount,
  DevSnapshot,
  FontsSnapshot,
  IconsSnapshot,
  ImagesSnapshot,
  MuxSnapshot,
  SeedSnapshot,
} from './lib/snapshot'
