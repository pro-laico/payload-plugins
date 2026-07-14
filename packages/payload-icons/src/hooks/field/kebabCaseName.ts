import type { FieldHook } from 'payload'

import { toKebabCase } from '../../lib/titleCase'

export const kebabCaseName: FieldHook = ({ value }) => (typeof value === 'string' ? toKebabCase(value) : value)
