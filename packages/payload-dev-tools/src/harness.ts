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

/** Identity helper — defines a test with full type-checking of its versions. */
export const defineTest = (test: Test): Test => test

/** Client-safe test metadata (no render fns) — what the toolbar UI receives. */
export type TestMeta = { key: string; label: string; kind: TestKind; versions: { id: string; label: string }[] }

export const toTestMeta = (tests: Test[]): TestMeta[] =>
  tests.map((t) => ({ key: t.key, label: t.label, kind: t.kind, versions: t.versions.map((v) => ({ id: v.id, label: v.label })) }))

export type ActiveStage = { test: Test; version: TestVersion }

/** Resolve a raw stage-cookie value (`testKey:versionId`) against the registered tests. Unknown
 *  or malformed values resolve to null — a stale cookie never breaks a page. */
export const parseStage = (raw: string | undefined, tests: Test[]): ActiveStage | null => {
  if (!raw) return null
  let decoded = raw
  try {
    decoded = decodeURIComponent(raw)
  } catch {
    return null
  }
  const sep = decoded.indexOf(':')
  if (sep < 1) return null
  const test = tests.find((t) => t.key === decoded.slice(0, sep))
  const version = test?.versions.find((v) => v.id === decoded.slice(sep + 1))
  return test && version ? { test, version } : null
}
