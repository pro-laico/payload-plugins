import { fontSource } from '@pro-laico/payload-fonts'
import { defineSeed } from '@pro-laico/payload-seed'

// Four typefaces seeded like image assets: the `fontSource()` token points at a file in
// `seed-assets/fonts/`; the fonts plugin's `font` collection hook uploads it to `fontOriginal`
// at create time and subsets it into a served `fontOptimized` WOFF2. Reference a typeface from
// the fontSet global (or any collection) via ref('font', <_key>).
export default defineSeed('font', () => [
  { _key: 'inter', title: 'Inter', family: 'sans', source: fontSource('inter.woff2', { weight: '400' }) },
  { _key: 'lora', title: 'Lora', family: 'serif', source: fontSource('lora.woff2', { weight: '400' }) },
  { _key: 'jetbrains-mono', title: 'JetBrains Mono', family: 'mono', source: fontSource('jetbrains-mono.woff2', { weight: '400' }) },
  { _key: 'abril-fatface', title: 'Abril Fatface', family: 'display', source: fontSource('abril-fatface.woff2', { weight: '400' }) },
])
