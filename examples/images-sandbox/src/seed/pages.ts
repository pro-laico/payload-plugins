import { defineSeed } from '@pro-laico/payload-seed'

// A page that references a seeded image by its asset key. The engine uploads the image
// assets FIRST, then resolves `asset('lighthouse')` to the created upload-doc id — the
// same token flow as any native Payload upload, no provider needed.
export default defineSeed('pages', ({ asset }) => [{ _key: 'home', title: 'Home', heroImage: asset('lighthouse') }])
