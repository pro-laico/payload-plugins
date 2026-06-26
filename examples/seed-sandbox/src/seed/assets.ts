import { defineAssets } from '@pro-laico/payload-seed'

/** The source assets the seed uploads first. Each key is referenceable via `asset(key)`
 *  in any seed file; the engine uploads them into the `media` collection and resolves
 *  the tokens to ids. Files live in `assets/image/`. */
export default defineAssets({
  serviceA: { file: 'service-a.jpg', alt: 'Consulting service' },
  serviceB: { file: 'service-b.jpg', alt: 'Implementation service' },
  post: { file: 'post-cover.jpg', alt: 'Blog post cover' },
  logo: { file: 'logo.jpg', alt: 'Brand logo' },
})
