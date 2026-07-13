import config from '@payload-config'
import { createIcon } from '@pro-laico/payload-icons/components/Icon'
import { getPayload } from 'payload'

// The one seam: the app's live Payload session seeds the plugin's icon component. Module
// scope on purpose — the per-request one-query memo is keyed by this handle reference.
// Exported as `Icon` so the usage scanner's default `<Icon name>` pattern still matches.
export const Icon = createIcon(getPayload({ config }))
