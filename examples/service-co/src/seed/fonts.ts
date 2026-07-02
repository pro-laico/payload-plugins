import { defineSeed } from '@pro-laico/payload-seed'

// The raw font files, seeded as native uploads into the hidden `fontOriginal` archive. Files live
// in `seed-assets/font/`, mapped to this collection via the seed plugin's `assetSubDirs` (the
// collection slug is `fontOriginal`, but `font/` reads better for a folder of font files).
export const fontOriginals = defineSeed('fontOriginal', ({ file }) => [
  { _key: 'inter-variable', _file: file('inter-variable.woff2') },
  { _key: 'lora', _file: file('lora.woff2') },
  { _key: 'lora-700', _file: file('lora-700.woff2') },
  { _key: 'jetbrains-mono', _file: file('jetbrains-mono.woff2') },
  { _key: 'abril-fatface', _file: file('abril-fatface.woff2') },
])

// Four typefaces spanning the two supported shapes — no asset-provider glue: the `font`
// collection's afterChange hook subsets each referenced original into a served `fontOptimized`
// WOFF2. Reference a typeface — e.g. from the fontSet global — via ref('font', <_key>). The
// ref('fontOriginal', …) edges also order originals before typefaces.
export default defineSeed('font', ({ ref }) => [
  // Variable: one file carries wght 100–900 — the realistic modern default for a workhorse sans.
  { _key: 'inter', title: 'Inter', family: 'sans', variable: { upright: ref('fontOriginal', 'inter-variable') } },
  // Static weights: one file per weight row — the classic body (400) + bold (700) pairing.
  {
    _key: 'lora',
    title: 'Lora',
    family: 'serif',
    weights: [
      { weight: '400', style: 'normal', file: ref('fontOriginal', 'lora') },
      { weight: '700', style: 'normal', file: ref('fontOriginal', 'lora-700') },
    ],
  },
  // A code font used at one weight — a single 400 row is the whole typeface.
  {
    _key: 'jetbrains-mono',
    title: 'JetBrains Mono',
    family: 'mono',
    weights: [{ weight: '400', style: 'normal', file: ref('fontOriginal', 'jetbrains-mono') }],
  },
  // Genuinely a single-style display face — Abril Fatface ships in one weight only.
  {
    _key: 'abril-fatface',
    title: 'Abril Fatface',
    family: 'display',
    weights: [{ weight: '400', style: 'normal', file: ref('fontOriginal', 'abril-fatface') }],
  },
])
