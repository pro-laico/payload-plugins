import type { RelId } from './primitives'

export type MediaImage = {
  id: RelId
  alt?: string | null
  src?: string | null
  srcset?: string | null
  placeholder?: string | null
}
