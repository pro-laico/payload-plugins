import { APIError, type CollectionBeforeValidateHook } from 'payload'

import { hasVariable, hasWeights } from '../../lib/fontDoc'

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
