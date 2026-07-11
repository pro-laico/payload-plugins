/** Options for building the managed Images collection (and the `extendCollection` enhancements). */

export interface CreateImagesOptions {
  /** Render the focal-point + ratio-preview field and the purge-variants button. Default true. */
  focalUI?: boolean
  /** Aspect ratios shown in the focal preview tiles. */
  previewRatios?: string[]
  /** Slug of the generated-images collection the `variants` join targets. */
  variantSlug?: string
  /** Purge route (under the API base) the purge button POSTs to. Default `/img/purge`. */
  purgePath?: string
  /** Admin thumbnail width (px), served via the transform endpoint so the admin never loads
   *  full-res originals. Default 160; `false` = Payload's default. */
  adminThumbnail?: number | false
  /** The app's API route base (`config.routes.api`). Default `/api`. */
  apiRoute?: string
  /** Whether the transform + purge endpoints are registered. When false, the UI that targets
   *  them (purge button, `variants` join) is skipped. Default true. */
  endpointsEnabled?: boolean
  /** Add the virtual `src`/`srcset`/`placeholderURL`/`thumbnailURL` fields. Default true. */
  virtualFields?: boolean
  /** Mark the `alt` field `localized: true` (requires Payload localization). Default false. */
  localizeAlt?: boolean
  /** Accepted upload mime types. Defaults to the raster formats the pipeline can transform. */
  mimeTypes?: string[]
  /** Enable Payload's native folder organization on the collection. Default false. */
  folders?: boolean
  /** Cap the *stored* original's longest edge (px) via `upload.resizeOptions`. Off by default. */
  maxOriginalSize?: number
  /** Wire the prewarm-enqueue afterChange hook (task slug + queue). Default off. */
  prewarm?: { taskSlug: string; queue: string } | false
}
