import type { IconProps } from './icon-props'

/** Props for the name-based `CmsIcon` — the ergonomic wrapper that resolves an icon's svg by name. */
export type CmsIconProps = Omit<IconProps, 'svg'> & {
  /** Icon name as defined in the active set's `iconsArray`. */
  name: string
}
