/** The single-field builder: a hidden virtual `text` field whose afterRead runs `compute`. */
import type { Field } from 'payload'

import { virtualUrlAfterRead } from '../../hooks/field/virtualUrl'
import type { ComputeContext, ImageDocLike } from '../../types'

export const virtualUrl = (name: string, description: string, compute: (doc: ImageDocLike, ctx: ComputeContext) => string | null): Field => ({
  name,
  type: 'text',
  virtual: true,
  admin: { hidden: true, description },
  hooks: { afterRead: [virtualUrlAfterRead(compute)] },
})
