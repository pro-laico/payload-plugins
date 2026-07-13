/**
 * Pure source-text extractor for the getter scan: finds `cacheDoc` / `cacheIds` /
 * `cacheGlobal` call sites and pulls out what the dev map needs — the collection/global
 * slug (second argument), the list scope and label (options literals), and the enclosing
 * function name. Regex-based like payload-icons' scanner: it reads LITERALS only; a slug
 * passed as a variable is invisible to the scan (the runtime observer still sees it).
 */

import type { ScannedCall } from '../../types'

const CALL_RE = /\bcache(Doc|Ids|Global)\s*\(/g
// Slug must start with a letter/underscore: an inline first argument can contain quoted
// sort tokens (`['-featured', '-publishedAt']`) whose leading '-' would otherwise be
// grabbed as the "slug".
const SLUG_RE = /,\s*['"`]([A-Za-z_][\w-]*)['"`]/
const LIST_RE = /\blist\s*:\s*['"`]([\w-]+)['"`]/
const LABEL_RE = /\blabel\s*:\s*['"`]([^'"`]+)['"`]/
const FN_RE = /(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)|(?:export\s+)?const\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\b|\()/g

export const extractGetterCalls = (source: string): ScannedCall[] => {
  const out: ScannedCall[] = []
  CALL_RE.lastIndex = 0
  for (let match = CALL_RE.exec(source); match; match = CALL_RE.exec(source)) {
    const helper = `cache${match[1]}` as ScannedCall['helper']
    // A bounded window after the call start: enough for the value expression + options.
    const tail = source.slice(match.index, match.index + 500)
    const slug = SLUG_RE.exec(tail)?.[1]
    if (!slug) continue

    const before = source.slice(0, match.index)
    let getter: string | undefined
    FN_RE.lastIndex = 0
    for (let fn = FN_RE.exec(before); fn; fn = FN_RE.exec(before)) getter = fn[1] ?? fn[2]

    out.push({
      helper,
      slug,
      list: LIST_RE.exec(tail)?.[1],
      label: LABEL_RE.exec(tail)?.[1],
      getter,
      line: before.split('\n').length,
    })
  }
  return out
}
