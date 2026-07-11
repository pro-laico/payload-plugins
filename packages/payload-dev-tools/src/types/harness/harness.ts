import type { ReactNode } from 'react'

/** How the toolbar groups and labels a test — purely presentational in v1 (every version stages
 *  in the same full-screen overlay). */
export type TestKind = 'page' | 'header' | 'footer' | 'block' | 'custom'

export type TestVersion = {
  /** Stable id — the cookie value segment. Keep it URL-safe (`[a-z0-9-]`). */
  id: string
  label: string
  /** A prop-less (optionally async) server component — fetch your own data inside it. Runs only
   *  when this version is staged, and only in dev. */
  render: () => ReactNode | Promise<ReactNode>
}

export type Test = {
  /** Stable key — the cookie value segment. Keep it URL-safe (`[a-z0-9-]`). */
  key: string
  label: string
  kind: TestKind
  versions: TestVersion[]
}

/** Client-safe test metadata (no render fns) — what the toolbar UI receives. */
export type TestMeta = { key: string; label: string; kind: TestKind; versions: { id: string; label: string }[] }

export type ActiveStage = { test: Test; version: TestVersion }
