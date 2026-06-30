import 'server-only'
import config from '@payload-config'
import { getIcon } from '@pro-laico/payload-icons'
import { getPayload } from 'payload'
import { Icon, type IconProps } from './Icon'

// The ergonomic, name-based icon — the common-usage entry point. A server component that resolves
// an icon by name from the CMS (`getIcon`) and renders the CVA-styled `<Icon>`. This is the thin
// data wrapper a real app writes once over the plugin's primitive; everything else is styling.

export type CmsIconProps = Omit<IconProps, 'svg'> & {
  /** Icon name — the filename with or without `.svg` (e.g. `arrow-right`). */
  name: string
}

export const CmsIcon = async ({ name, ...rest }: CmsIconProps) => {
  const payload = await getPayload({ config })
  const icon = await getIcon(payload, name)
  return <Icon svg={icon?.svgString} {...rest} /> // renders nothing if the name doesn't resolve
}

export default CmsIcon
