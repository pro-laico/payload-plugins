import type { PresetSpec } from '../presets/preset'

/** Props for the presetManager admin field component (templates come from plugin config). */
export interface PresetManagerProps {
  /** The plugin's preset templates (name → spec), shown as toggle chips with their settings. */
  templates?: Record<string, PresetSpec>
}
