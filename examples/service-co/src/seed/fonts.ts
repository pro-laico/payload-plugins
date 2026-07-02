import { defineSeed } from '@pro-laico/payload-seed'

// The raw font files, seeded as native uploads into the hidden `fontOriginal` archive. Files live
// in `seed-assets/font/`, mapped to this collection via the seed plugin's `assetSubDirs` (the
// collection slug is `fontOriginal`, but `font/` reads better for a folder of font files).
export const fontOriginals = defineSeed('fontOriginal', ({ file }) => [
  { _key: 'inter-variable', _file: file('inter-variable.woff2') },
  { _key: 'inter-variable-italic', _file: file('inter-variable-italic.woff2') },
  { _key: 'lora', _file: file('lora.woff2') },
  { _key: 'lora-italic', _file: file('lora-italic.woff2') },
  { _key: 'lora-700', _file: file('lora-700.woff2') },
  { _key: 'lora-700-italic', _file: file('lora-700-italic.woff2') },
  { _key: 'jetbrains-mono', _file: file('jetbrains-mono.woff2') },
  { _key: 'jetbrains-mono-italic', _file: file('jetbrains-mono-italic.woff2') },
  { _key: 'jetbrains-mono-700', _file: file('jetbrains-mono-700.woff2') },
  { _key: 'jetbrains-mono-700-italic', _file: file('jetbrains-mono-700-italic.woff2') },
  { _key: 'recursive-variable', _file: file('recursive-variable.woff2') },
])

// Four typefaces covering every supported shape — no asset-provider glue: the `font` collection's
// afterChange hook subsets each referenced original into a served `fontOptimized` WOFF2.
// Reference a typeface — e.g. from the fontSet global — via ref('font', <_key>). The
// ref('fontOriginal', …) edges also order originals before typefaces.
export default defineSeed('font', ({ ref }) => [
  // Variable, upright + italic as SEPARATE files: each slot carries wght 100–900.
  {
    _key: 'inter',
    title: 'Inter',
    family: 'sans',
    variable: { upright: ref('fontOriginal', 'inter-variable'), italic: ref('fontOriginal', 'inter-variable-italic') },
  },
  // Static weights WITH italics: one file per weight/style row — the classic 400/700 pairing.
  {
    _key: 'lora',
    title: 'Lora',
    family: 'serif',
    weights: [
      { weight: '400', style: 'normal', file: ref('fontOriginal', 'lora') },
      { weight: '400', style: 'italic', file: ref('fontOriginal', 'lora-italic') },
      { weight: '700', style: 'normal', file: ref('fontOriginal', 'lora-700') },
      { weight: '700', style: 'italic', file: ref('fontOriginal', 'lora-700-italic') },
    ],
  },
  // The same static shape for the code font.
  {
    _key: 'jetbrains-mono',
    title: 'JetBrains Mono',
    family: 'mono',
    weights: [
      { weight: '400', style: 'normal', file: ref('fontOriginal', 'jetbrains-mono') },
      { weight: '400', style: 'italic', file: ref('fontOriginal', 'jetbrains-mono-italic') },
      { weight: '700', style: 'normal', file: ref('fontOriginal', 'jetbrains-mono-700') },
      { weight: '700', style: 'italic', file: ref('fontOriginal', 'jetbrains-mono-700-italic') },
    ],
  },
  // Variable, ONE file carrying BOTH styles: Recursive's axes include wght 300–1000 and
  // slnt 0…-15, so the optimize hook flags the file ital-capable and the site serves an italic
  // face from the same upload — nothing extra to reference here.
  { _key: 'recursive', title: 'Recursive', family: 'display', variable: { upright: ref('fontOriginal', 'recursive-variable') } },
])
