import { getPayload } from 'payload'
import { createIcon } from '@pro-laico/payload-icons/components/Icon'

import config from '@payload-config'

export const Icon = createIcon(getPayload({ config }))
