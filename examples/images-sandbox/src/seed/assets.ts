import { defineAssets } from '@pro-laico/payload-seed'

/** The source images the seed uploads first. Each key is referenceable via `asset(key)`
 *  in any seed file; the engine uploads them into the `images` collection (set via
 *  `assets.collection` in src/plugins/index.ts) and resolves the tokens to ids. Files
 *  live in `seed-assets/image/`.
 *
 *  `focalX`/`focalY` (percentages from the top-left) mark each photo's off-center
 *  subject, so the on-demand focal-aware crops keep it in frame across aspect ratios. */
export default defineAssets({
  lighthouse: { file: 'lighthouse.png', alt: 'Landscape sample', focalX: 78, focalY: 32 },
  balloon: { file: 'balloon.png', alt: 'Portrait sample', focalX: 50, focalY: 22 },
  apple: { file: 'apple.png', alt: 'Square sample', focalX: 28, focalY: 72 },
})
