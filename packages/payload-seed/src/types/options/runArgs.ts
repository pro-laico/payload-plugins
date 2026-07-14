import type { Payload, PayloadRequest } from 'payload'

import type { ResolvedSeedOptions } from './options'
import type { SeedDefinition } from '../definitions/definitions'

export interface RunSeedArgs {
  payload: Payload
  req: PayloadRequest
  options: ResolvedSeedOptions
  definitions?: SeedDefinition[]
}
