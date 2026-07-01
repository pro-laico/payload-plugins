import { defineCollectionSeed } from '@pro-laico/payload-seed'

// A page that references a seeded icon by ref — a typed cross-file dependency edge. The engine
// creates the icon docs (uploading their `_file`) first, then resolves ref('icon', 'star') to its id.
export default defineCollectionSeed('pages', ({ ref }) => [{ _key: 'home', title: 'Home', icon: ref('icon', 'star') }])
