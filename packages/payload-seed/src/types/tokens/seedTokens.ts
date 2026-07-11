import type { file, ref } from '../../refs'

/** Tokens handed to every seed builder: `ref` (point at another seeded doc) and `file`
 *  (attach a source file to an upload/provider doc via its `_file`). Typed from the token
 *  constructors themselves (`typeof ref` / `typeof file`), so it stays co-located with the
 *  runtime values it mirrors via a type-only import. */
export interface SeedTokens {
  ref: typeof ref
  file: typeof file
}
