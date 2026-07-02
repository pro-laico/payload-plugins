import { defineSeed } from '@pro-laico/payload-seed'

// The active selection: one typeface per family, wired with ordinary `ref('font', …)` tokens. The
// engine creates the typefaces first (they carry no dependencies), then resolves these refs
// to their ids and updates the global. The export endpoint reads this to decide what to ship.
// Display picks Recursive (the ital-capable variable file) — Abril Fatface stays uploaded but inactive.
export default defineSeed('fontSet', ({ ref }) => ({
  sans: ref('font', 'inter'),
  serif: ref('font', 'lora'),
  mono: ref('font', 'jetbrains-mono'),
  display: ref('font', 'recursive'),
}))
