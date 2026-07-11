/** The minimal upload-doc shape the byte reader consumes, plus the storage-adapter handler signature. */
import type { PayloadRequest } from 'payload'

export interface UploadDocLike {
  filename?: string | null
  url?: string | null
  /** Cloud-storage adapters store their key prefix on the doc. */
  prefix?: string | null
}

export type UploadHandler = (
  req: PayloadRequest,
  args: { doc: unknown; headers?: Headers; params: { collection: string; filename: string; prefix?: string } },
  // biome-ignore lint/suspicious/noConfusingVoidType: mirrors Payload's upload handler signature, which returns void
) => Promise<Response | void> | Response | void
