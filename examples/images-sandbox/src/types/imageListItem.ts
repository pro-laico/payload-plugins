// The page-level list read is a light projection for the card headers; the pixels + placeholder
// are each tile's own concern — <Image id> self-fetches exactly what it renders.
export type ImageListItem = {
  id: string | number
  alt?: string | null
  width?: number | null
  height?: number | null
  focalX?: number | null
  focalY?: number | null
}
