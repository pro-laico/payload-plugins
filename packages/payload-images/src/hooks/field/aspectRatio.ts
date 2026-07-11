/** The `aspectRatio` field's afterRead: the ratio the read declared (context.image), else natural. */
import type { FieldHook } from 'payload'

import { readImageIntent } from '../../lib/renderIntent'
import { type ImageDocLike, naturalAspectRatio } from '../../fields/virtualUrls/doc'

export const aspectRatioAfterRead: FieldHook = ({ data, req }) => {
  const doc = (data ?? {}) as ImageDocLike //EXCUSE: hook data is untyped; every field is duck-checked before use
  return readImageIntent(req).aspectRatio ?? naturalAspectRatio(doc) ?? null
}
