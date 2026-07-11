import type { MuxVideo } from '@/payload-types'

/** A mux-video doc widened with the plugin's `status` field — the generated `MuxVideo` type
 *  predates it, so it's added locally. */
export type VideoDoc = MuxVideo & { status?: 'preparing' | 'ready' | 'errored' | null }
