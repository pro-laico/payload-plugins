import { defineSeed } from '@pro-laico/payload-seed'

// The raw font files, seeded as native uploads into the hidden `fontOriginal` archive. Files live
// in `seed-assets/font/`, mapped to this collection via the seed plugin's `assetSubDirs` (the
// collection slug is `fontOriginal`, but `font/` reads better for a folder of font files).
export const fontOriginals = defineSeed('fontOriginal', ({ file }) => [
  { _key: 'inter', _file: file('inter.woff2') },
  { _key: 'lora', _file: file('lora.woff2') },
  { _key: 'jetbrains-mono', _file: file('jetbrains-mono.woff2') },
  { _key: 'abril-fatface', _file: file('abril-fatface.woff2') },
])

// Four typefaces, each referencing its archived original in a single 400/normal weight slot — no
// asset-provider glue: the `font` collection's afterChange hook subsets each referenced original
// into a served `fontOptimized` WOFF2. Reference a typeface — e.g. from the fontSet global — via
// ref('font', <_key>). The `ref('fontOriginal', …)` edges also order originals before typefaces.
export default defineSeed('font', ({ ref }) => [
  { _key: 'inter', title: 'Inter', family: 'sans', weights: [{ weight: '400', style: 'normal', file: ref('fontOriginal', 'inter') }] },
  { _key: 'lora', title: 'Lora', family: 'serif', weights: [{ weight: '400', style: 'normal', file: ref('fontOriginal', 'lora') }] },
  {
    _key: 'jetbrains-mono',
    title: 'JetBrains Mono',
    family: 'mono',
    weights: [{ weight: '400', style: 'normal', file: ref('fontOriginal', 'jetbrains-mono') }],
  },
  {
    _key: 'abril-fatface',
    title: 'Abril Fatface',
    family: 'display',
    weights: [{ weight: '400', style: 'normal', file: ref('fontOriginal', 'abril-fatface') }],
  },
])
