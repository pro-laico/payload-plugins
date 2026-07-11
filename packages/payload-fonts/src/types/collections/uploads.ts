import type { PayloadRequest } from 'payload'

/** The readable slice of any upload doc: a local filename and/or a URL (plus the
 *  cloud-storage `prefix` when the adapter stores one). */
export type UploadDoc = { filename?: string | null; url?: string | null; prefix?: string | null }

export type UploadHandler = (
  req: PayloadRequest,
  args: { doc: unknown; headers?: Headers; params: { collection: string; filename: string; prefix?: string } },
  // biome-ignore lint/suspicious/noConfusingVoidType: mirrors Payload's upload handler signature, which returns void
) => Promise<Response | void> | Response | void
