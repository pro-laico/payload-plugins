import { defineCollectionSeed } from '@pro-laico/payload-seed'

// A page that references a seeded image by ref. The engine creates the images doc (uploading its
// `_file`) before this page, then resolves ref('images', 'lighthouse') to its id.
export default defineCollectionSeed('pages', ({ ref }) => [{ _key: 'home', title: 'Home', heroImage: ref('images', 'lighthouse') }])
