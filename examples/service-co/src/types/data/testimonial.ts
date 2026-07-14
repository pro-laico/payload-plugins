import type { RelId } from './primitives'

export type Testimonial = { id: RelId; quote: string; author: string; company?: string | null; project?: RelId | null }
