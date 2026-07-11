/**
 * The afterRead behind every virtual URL field: bail on an unsaved/fileless doc, else hand the
 * doc + compute context (origin, srcset step, declared render) to the field's `compute` fn.
 */
import type { FieldHook } from 'payload'

import { readPluginMarker } from '../../lib/pluginMarker'
import { readImageIntent } from '../../lib/renderIntent'
import type { ComputeContext, ImageDocLike } from '../../fields/virtualUrls/doc'

/** Build a virtual URL field's afterRead from its `(doc, ctx) => url` computer. */
export const virtualUrlAfterRead =
  (compute: (doc: ImageDocLike, ctx: ComputeContext) => string | null): FieldHook =>
  ({ data, req }) => {
    const doc = (data ?? {}) as ImageDocLike //EXCUSE: hook data is untyped; every field is duck-checked before use
    if (doc.id == null || !doc.filename) return null
    const cfg = req?.payload?.config
    return compute(doc, { baseUrl: cfg?.serverURL || '', pixelStep: readPluginMarker(cfg).pixelStep, intent: readImageIntent(req) })
  }
