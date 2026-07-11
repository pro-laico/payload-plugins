import type { CheckboxField } from 'payload'

/**
 * The single-active toggle for the `iconSet` collection. The frontend renders
 * whichever set has `active: true` (in its status lane), so flipping this on one
 * set re-skins every `<Icon>` across the site. The invariant is enforced by
 * `enforceSingleActive` (see `../hooks/collection/enforceSingleActive`).
 */
export const activeField: CheckboxField = {
  name: 'active',
  type: 'checkbox',
  defaultValue: false,
  index: true,
  admin: {
    description: 'Render this set across the frontend. Activating a set deactivates the others.',
    style: { maxWidth: '160px', alignSelf: 'center' },
  },
}
