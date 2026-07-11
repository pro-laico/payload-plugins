import type { Payload, PayloadRequest } from 'payload'
import type { SeedDefinition } from '../definitions/definitions'
import type { ResolvedSeedOptions } from './options'

export interface RunSeedArgs {
  payload: Payload
  req: PayloadRequest
  options: ResolvedSeedOptions
  /** Seed definitions. Falls back to `options.definitions` when omitted. */
  definitions?: SeedDefinition[]
}
