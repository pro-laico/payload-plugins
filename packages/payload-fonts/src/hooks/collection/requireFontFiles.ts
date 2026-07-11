import { APIError, type CollectionBeforeValidateHook } from 'payload'

import { hasVariable, hasWeights } from '../../lib/fontDoc'

/**
 * `beforeValidate`: a typeface needs at least one file, and can't mix a variable font with
 * specific weights (you compose from one or the other). Runs on create and on any update that
 * touches these fields, so an unrelated partial edit is left alone.
 */
export const requireFontFiles: CollectionBeforeValidateHook = ({ data, operation }) => {
  const touches = operation === 'create' || (data != null && ('variable' in data || 'weights' in data))
  if (!touches) return data
  if (hasVariable(data) && hasWeights(data)) {
    throw new APIError('Use either a variable font or specific weight files, not both.', 400, null, true)
  }
  if (!hasVariable(data) && !hasWeights(data)) {
    throw new APIError('Add at least one font file before saving.', 400, null, true)
  }
  return data
}
