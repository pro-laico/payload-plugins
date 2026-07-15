import type { PayloadRequest } from 'payload'

export interface UploadDocLike {
  filename?: string | null
  filesize?: number | null
  url?: string | null
  prefix?: string | null
}

export type UploadHandler = (
  req: PayloadRequest,
  args: { doc: unknown; headers?: Headers; params: { collection: string; filename: string; prefix?: string } },
  // biome-ignore lint/suspicious/noConfusingVoidType: mirrors Payload's upload handler signature, which returns void
) => Promise<Response | void> | Response | void
