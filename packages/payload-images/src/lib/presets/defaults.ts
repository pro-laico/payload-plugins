/** Defaults for the variant cap and preset templates, merged with any user config. */
import type { PresetSpec } from '../../types'

/** Per-image cap on cached variants before new sizes serve from a nearby existing one. */
export const DEFAULT_VARIANT_LIMIT = 200

/** Ships an `og` template so social images work with zero config. User templates override/extend it. */
export const DEFAULT_PRESET_TEMPLATES: Record<string, PresetSpec> = {
  og: { width: 1200, height: 630, fit: 'cover', quality: 80, format: 'jpeg' },
}

export const resolvePresetTemplates = (user?: Record<string, PresetSpec>): Record<string, PresetSpec> => ({
  ...DEFAULT_PRESET_TEMPLATES,
  ...user,
})
