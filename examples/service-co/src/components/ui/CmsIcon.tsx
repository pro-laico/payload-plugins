import config from '@payload-config'
import { getPayload } from 'payload'
import { getIconSvg } from '@pro-laico/payload-icons/cache'

import { Icon } from './Icon'
import type { CmsIconProps } from '@/types'

import 'server-only'

const db = getPayload({ config })

export const CmsIcon = async ({ name, ...rest }: CmsIconProps) => {
  const svg = await getIconSvg(db, name)
  return <Icon svg={svg} {...rest} />
}

export default CmsIcon
