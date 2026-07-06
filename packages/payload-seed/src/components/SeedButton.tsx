import type React from 'react'
import { seedingEnabled } from '../guard'
import { SeedButtonClient, type SeedButtonProps } from './SeedButtonClient'

export type { SeedButtonProps }

/** Admin dashboard button that triggers `POST /api/seed`. Injected via the plugin's
 *  `adminButton` option, or registered manually in `admin.components.actions`.
 *  Server component: renders nothing unless the `ENABLE_SEED` guard allows seeding,
 *  so environments where the endpoint would refuse anyway never show the button. */
export const SeedButton: React.FC<SeedButtonProps> = (props) => (seedingEnabled() ? <SeedButtonClient {...props} /> : null)

export default SeedButton
