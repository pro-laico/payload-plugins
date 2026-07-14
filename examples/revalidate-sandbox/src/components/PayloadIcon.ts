import config from '@payload-config'
import { getPayload } from 'payload'
import { createIcon } from '@pro-laico/payload-icons/components/Icon'

export const Icon = createIcon(getPayload({ config }))
