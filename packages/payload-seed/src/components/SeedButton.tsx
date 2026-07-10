import type React from 'react'
import { seedingEnabled } from '../guard'
import { SeedButtonClient, type SeedButtonProps } from './SeedButtonClient'

export type { SeedButtonProps }

/** Admin dashboard button that triggers `POST /api/seed`. Injected via the plugin's
 *  `adminButton` option, or registered manually in `admin.components.actions`.
 *  Server component: renders nothing unless the `ENABLE_SEED` guard allows seeding,
 *  so environments where the endpoint would refuse anyway never show the button.
 *
 *  As an `admin.components.actions` entry this receives Payload's full server-prop bag
 *  (`payload`, `i18n`, `user`, ...) — non-serializable (functions, circular refs), so it must
 *  NEVER be spread into the client half: pass exactly what `SeedButtonClient` needs. */
export const SeedButton: React.FC<SeedButtonProps> = ({ endpoint }) => (seedingEnabled() ? <SeedButtonClient endpoint={endpoint} /> : null)

export default SeedButton
