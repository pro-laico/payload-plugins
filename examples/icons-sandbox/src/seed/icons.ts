import { defineAssets } from '@pro-laico/payload-seed'

// Icons seed like any other upload asset — no plugin-specific helper. Each SVG in `seed-assets/svg/`
// is uploaded (running the optimize/sanitize hook) and referenceable elsewhere by its key — e.g.
// `asset('star')`. The target `icon` collection is set once on the seed plugin (`assets.collection`).
export default defineAssets({
  'arrow-right': { file: 'arrow-right.svg' },
  check: { file: 'check.svg' },
  star: { file: 'star.svg' },
})
