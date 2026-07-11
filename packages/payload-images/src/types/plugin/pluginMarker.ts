/** The `custom.payloadImages` marker the plugin stamps onto the config at init. */
import type { OutputFormat } from '../transform/format'
import type { TransformConstraints } from '../transform/transformConstraints'
import type { RenderProfileSeed } from '../prewarm/options'

/** Prewarm wiring stamped for out-of-request consumers (the `images:prewarm` CLI). */
export interface PayloadImagesPrewarmMarker {
  profilesSlug: string
  taskSlug: string
  queue: string
  formats: OutputFormat[]
  maxVariantsPerImage: number
  seeds: RenderProfileSeed[]
  /** The transform endpoint's RESOLVED constraints — replayed so CLI-computed keys match. */
  constraints: TransformConstraints
}

export interface PayloadImagesMarker {
  sourceSlug?: string
  variantSlug?: string
  basePath?: string
  pixelStep?: number | number[]
  /** Present only when the `prewarm` option is on. */
  prewarm?: PayloadImagesPrewarmMarker
}
