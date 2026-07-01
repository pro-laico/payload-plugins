import 'server-only'
import { getIconSvg } from '@pro-laico/payload-icons/cache'
import { Icon, type IconProps } from './Icon'

// The ergonomic, name-based icon — the common-usage entry point. A server component that resolves
// an icon's svg by name through the ACTIVE set (`getIconSvg`) and renders the CVA-styled `<Icon>`.
// This is the thin data wrapper a real app writes once over the plugin's resolver; everything else
// is styling.

export type CmsIconProps = Omit<IconProps, 'svg'> & {
  /** Icon name as defined in the active set's `iconsArray`. */
  name: string
}

export const CmsIcon = async ({ name, ...rest }: CmsIconProps) => {
  const svg = await getIconSvg(name)
  return <Icon svg={svg} {...rest} /> // renders nothing if the name isn't in the active set
}

export default CmsIcon
