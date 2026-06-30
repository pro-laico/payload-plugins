import { iconAssets } from '@pro-laico/payload-icons'
import { defineAssets } from '@pro-laico/payload-seed'

// Icons seed like any other upload asset: each SVG in `seed-assets/svg/` is uploaded to the
// `icon` collection (running the optimize/sanitize hook) and is referenceable elsewhere by its
// filename base — e.g. `asset('star')`. `iconAssets` just pre-targets the `icon` collection.
export default defineAssets(iconAssets(['arrow-right.svg', 'check.svg', 'star.svg']))
