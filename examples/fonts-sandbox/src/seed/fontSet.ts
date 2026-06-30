import { defineGlobalSeed } from '@pro-laico/payload-seed'

// The active selection: one typeface per role, wired with ordinary `ref('font', …)` tokens. The
// engine creates the four typefaces first (they carry no dependencies), then resolves these refs
// to their ids and updates the global. The export endpoint reads this to decide what to ship.
export default defineGlobalSeed('fontSet', ({ ref }) => ({
  sans: ref('font', 'inter'),
  serif: ref('font', 'lora'),
  mono: ref('font', 'jetbrains-mono'),
  display: ref('font', 'abril-fatface'),
}))
