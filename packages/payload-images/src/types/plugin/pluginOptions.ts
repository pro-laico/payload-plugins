/** The plugin's top-level options object. */
import type { CollectionConfig } from 'payload'

import type { PresetTemplate } from '../presets/preset'
import type { PrewarmOptions } from '../prewarm/options'
import type { TransformEndpointConfig } from '../transform/transformEndpoint'

export interface ImagesPluginOptions {
  /**
   * When false, the plugin registers NOTHING. This is "not installed", not "temporarily
   * disabled": on SQL adapters, flipping it off produces a migration that DROPS the images /
   * generated-images tables and their data. Default true.
   */
  enabled?: boolean
  /**
   * Slug of an EXISTING upload collection to add the image pipeline to, instead of creating the
   * default `images` collection — no second collection, no migration. You own that collection's
   * `upload` config (including any `imageSizes`).
   */
  extendCollection?: string
  /**
   * Override for the Images collection. Top-level keys replace; `upload`/`access`/`admin`
   * deep-merge; `fields`/`hooks` APPEND (don't redeclare a base field's `name`). With
   * `extendCollection`, merged onto the target collection instead.
   */
  imagesOverrides?: Partial<CollectionConfig>
  /** Override for the hidden generated-images (variant cache) collection. */
  generatedImagesOverrides?: Partial<CollectionConfig>
  /**
   * The project-wide srcset widths. A **number** (default 50) is the width increment AND the
   * endpoint's anti-DoS snap grid; an **array** is an explicit non-linear width ladder for the
   * srcset (use multiples of 50, or set `transform.dimensionStep`, so ladder widths pass the
   * snap unchanged). `transform.maxDimension` caps either form.
   */
  pixelStep?: number | number[]
  /** On-demand transform endpoint config. Pass `false` to not register the endpoints. */
  transform?: TransformEndpointConfig | false
  /** Render the focal + ratio-preview field and purge-variants button. Default true. */
  focalUI?: boolean
  /** Aspect ratios shown in the focal preview tiles. */
  previewRatios?: string[]
  /**
   * Add virtual `src` / `srcset` / `placeholderURL` / `thumbnailURL` fields, computed on read,
   * so optimized URLs ride along in every response and through relationship population.
   * Default true; defaults to false with `transform: false` (the URLs would 404).
   */
  virtualFields?: boolean
  /** Mark the `alt` field `localized: true` (requires Payload localization). Ignored with
   *  `extendCollection`. Default false. */
  localizeAlt?: boolean
  /** Accepted upload mime types. Defaults to the raster formats the pipeline can transform
   *  (avif/webp/jpeg/png); non-raster uploads are stored and served as-is. Ignored with
   *  `extendCollection`. */
  mimeTypes?: string[]
  /** Enable Payload's native folder organization on the managed collection. Default false. */
  folders?: boolean
  /** Cap the *stored* original's longest edge in px (applied once on upload). Off by default —
   *  the original stays untouched. Ignored with `extendCollection`. */
  maxOriginalSize?: number
  /**
   * Smart prewarming: learn which variants the site actually serves (recorded off the transform
   * endpoint — ground truth) and pre-generate them for new/replaced/re-focused images via a
   * deferred Payload Job. Adds the hidden `image-render-profiles` collection, the `imagesPrewarm`
   * jobs task, and the `images:prewarm` CLI. Default false — enabling is a schema change
   * (new collection). `true` = zero-config defaults.
   */
  prewarm?: boolean | PrewarmOptions
  /**
   * Per-image cap on cached variants (bounds storage from the public endpoint). Past the cap, a
   * new freeform size is served from a nearby existing variant instead of generated + stored. Each
   * image has a `variantLimit` field defaulting to this. Presets are exempt. Default 200.
   */
  variantLimit?: number
  /**
   * Named preset templates — guaranteed, cap-exempt, eagerly pre-generated variants that editors
   * toggle onto images by name and serve via `/api/img/:id?preset=<name>`. A default `og`
   * (1200×630) ships unless overridden.
   */
  presetTemplates?: Record<string, PresetTemplate>
}
