import type { FieldHook } from 'payload'

import { toKebabCase } from '../../lib/titleCase'

/** `beforeValidate` field hook for an `iconsArray` row's `name`: normalize the typed value to
 *  kebab-case so it matches the name the frontend looks the icon up by (`<Icon name>`). */
export const kebabCaseName: FieldHook = ({ value }) => (typeof value === 'string' ? toKebabCase(value) : value)
