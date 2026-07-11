import type { IconProps } from './icon'

export type CmsIconProps = Omit<IconProps, 'svg'> & {
  /** Icon name as defined in the active set's `iconsArray`. */
  name: string
}
