import type { PayloadRequest } from 'payload'

import { defaultAccess } from './defaultAccess'
import type { ResolvedMuxVideoOptions } from '../types'

export const isAllowed = async (options: ResolvedMuxVideoOptions, req: PayloadRequest): Promise<boolean> =>
  (await options.access?.(req)) ?? defaultAccess(req)
