import type { Payload } from 'payload'

export interface LabBoot {
  payload: Payload
  cleanup: () => Promise<void>
}
