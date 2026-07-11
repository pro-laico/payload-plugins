import type { ActiveStage, Test, TestMeta } from './types'

/** Identity helper — defines a test with full type-checking of its versions. */
export const defineTest = (test: Test): Test => test

export const toTestMeta = (tests: Test[]): TestMeta[] =>
  tests.map((t) => ({ key: t.key, label: t.label, kind: t.kind, versions: t.versions.map((v) => ({ id: v.id, label: v.label })) }))

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
