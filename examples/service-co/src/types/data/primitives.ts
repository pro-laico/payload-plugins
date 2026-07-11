// Light view models for the frontend. We deliberately don't import Payload's generated types here:
// these name only the fields the site renders. Every read is `depth: 0` (the payload-revalidate
// atomic model — references stay ids and resolve through their own id-keyed getters), so every
// relationship field is a bare id.

/** A `depth: 0` relationship value — the referenced doc's id. */
export type RelId = string | number
