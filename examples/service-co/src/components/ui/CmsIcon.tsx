import 'server-only'
import config from '@payload-config'
import { getIconSvg } from '@pro-laico/payload-icons/cache'
import { getPayload } from 'payload'
import type { CmsIconProps } from '@/types'
import { Icon } from './Icon'

// The ergonomic, name-based icon — the common-usage entry point. A server component that resolves
// an icon's svg by name through the ACTIVE set (`getIconSvg`, on this app's live session) and
// renders the CVA-styled `<Icon>`. This is the thin data wrapper a real app writes once over the
// plugin's resolver; everything else is styling.

// Module scope: the resolver's per-request one-query memo is keyed by this handle reference.
const db = getPayload({ config })

export const CmsIcon = async ({ name, ...rest }: CmsIconProps) => {
  const svg = await getIconSvg(db, name)
  return <Icon svg={svg} {...rest} /> // renders nothing if the name isn't in the active set
}

export default CmsIcon
