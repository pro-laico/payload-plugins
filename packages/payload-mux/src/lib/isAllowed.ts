import type { PayloadRequest } from 'payload'

import { defaultAccess } from './defaultAccess'
import type { MuxVideoPluginOptions } from '../types'

export const isAllowed = async (options: MuxVideoPluginOptions, req: PayloadRequest): Promise<boolean> =>
  (await options.access?.(req)) ?? defaultAccess(req)
