/** Named, guaranteed image variants — cap-exempt and eagerly pre-generated. */
import type { AspectRatio } from '../plugin/renderIntent'
import type { Fit, OutputFormat } from '../transform/format'

/** The concrete shape of a preset variant — reusable via config `presetTemplates` (toggled onto
 *  images by name) or inline on an image. Partial — omitted axes take the endpoint defaults. */
export interface PresetSpec {
  width?: number
  height?: number
  aspectRatio?: AspectRatio
  fit?: Fit
  quality?: number
  format?: OutputFormat
}

/** One entry on an image's `presets` array: a template reference (`template` set) OR a custom
 *  inline preset (`name` + spec). Resolved by {@link resolvePreset}. */
export interface PresetEntry extends PresetSpec {
  /** Name of a config `presetTemplates` entry — resolved from config at request time (DRY). */
  template?: string | null
  /** Name of a custom, image-specific preset (ignored when `template` is set). */
  name?: string | null
}
