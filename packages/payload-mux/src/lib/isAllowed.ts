import type { PayloadRequest } from 'payload'

import { defaultAccess } from './defaultAccess'
import type { MuxAccessFn } from '../types'

/** Runs one of the `access` gates, falling back to a logged-in admin-collection user. */
export const isAllowed = async (gate: MuxAccessFn | undefined, req: PayloadRequest): Promise<boolean> =>
  (await gate?.(req)) ?? defaultAccess(req)
