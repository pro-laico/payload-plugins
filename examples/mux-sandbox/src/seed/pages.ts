import { defineCollectionSeed } from '@pro-laico/payload-seed'

// A page that references the seeded video by its _key — a typed cross-file dependency edge.
// The engine creates the mux-video first (topological order), then resolves the ref to its id.
export default defineCollectionSeed('pages', ({ ref }) => [{ _key: 'home', title: 'Home', heroVideo: ref('mux-video', 'sample') }])
