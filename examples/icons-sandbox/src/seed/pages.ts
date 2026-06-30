import { defineSeed } from '@pro-laico/payload-seed'

// A page that references a seeded icon by its asset key — a typed cross-file dependency edge.
// The engine uploads the icons first, then resolves `asset('star')` to the created icon's id.
export default defineSeed('pages', ({ asset }) => [{ _key: 'home', title: 'Home', icon: asset('star') }])
