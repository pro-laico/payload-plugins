import type { PayloadRequest } from 'payload'
import type { MuxVideoPluginOptions } from '../types'
import { defaultAccess } from './defaultAccess'

/** Resolve the plugin's access gate for a request: the configured `access` option if given,
 *  else the default logged-in-admin check. Shared by the upload endpoints and the collection
 *  `read` access so the gate stays defined in one place. */
export const isAllowed = async (options: MuxVideoPluginOptions, req: PayloadRequest): Promise<boolean> =>
  (await options.access?.(req)) ?? defaultAccess(req)
