import type { PresetSpec } from '../../types'

export const DEFAULT_VARIANT_LIMIT = 200

export const DEFAULT_PRESET_TEMPLATES: Record<string, PresetSpec> = {
  og: { width: 1200, height: 630, fit: 'cover', quality: 80, format: 'jpeg' },
}

export const resolvePresetTemplates = (user?: Record<string, PresetSpec>): Record<string, PresetSpec> => ({
  ...DEFAULT_PRESET_TEMPLATES,
  ...user,
})
