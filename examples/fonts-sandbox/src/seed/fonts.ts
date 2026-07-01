import { defineSeed } from '@pro-laico/payload-seed'

// Four typefaces seeded like any collection: each carries its font file on the `_file` meta-key,
// with `weight` passed through to the `font` provider's ingest hook (which uploads to fontOriginal
// and subsets it into a served fontOptimized WOFF2). Reference a typeface — e.g. from the fontSet
// global — via ref('font', <_key>). Files live in `seed-assets/fonts/`.
export default defineSeed('font', ({ file }) => [
  { _key: 'inter', _file: file('inter.woff2', { weight: '400' }), title: 'Inter', family: 'sans' },
  { _key: 'lora', _file: file('lora.woff2', { weight: '400' }), title: 'Lora', family: 'serif' },
  { _key: 'jetbrains-mono', _file: file('jetbrains-mono.woff2', { weight: '400' }), title: 'JetBrains Mono', family: 'mono' },
  { _key: 'abril-fatface', _file: file('abril-fatface.woff2', { weight: '400' }), title: 'Abril Fatface', family: 'display' },
])
