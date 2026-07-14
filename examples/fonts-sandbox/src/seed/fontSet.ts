import { defineSeed } from '@pro-laico/payload-seed'

export default defineSeed('fontSet', ({ ref }) => ({
  sans: ref('font', 'inter'),
  serif: ref('font', 'lora'),
  mono: ref('font', 'jetbrains-mono'),
  display: ref('font', 'recursive'),
}))
