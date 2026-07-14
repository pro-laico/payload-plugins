import type { PresetSpec } from '../presets/preset'

export interface PresetManagerProps {
  templates?: Record<string, PresetSpec>
}
