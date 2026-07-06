import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { buildConfig, type CollectionConfig, type GlobalConfig } from 'payload'
import { flags } from './flags'
import { captureDestination } from './logCapture'

// A config DESIGNED TO FAIL. Every collection here exists to trigger one seed failure path on
// purpose, so the tests can check the resulting error/warning is legible and identifiable —
// testing the failure story, not the success story. Data-driven traps use magic values ('boom');
// runtime traps use the mutable `flags` switches.

const filename = fileURLToPath(import.meta.url)
const currentDir = dirname(filename)

const Users: CollectionConfig = { slug: 'users', auth: true, fields: [] }

/** The workhorse. `status: 'boom'` fails validation at create; `flags.failThingUpdates` fails any
 *  update (→ the deferred-field second pass); `related` self-refs form breakable cycles; `flakyRef`
 *  optionally points at the always-skipped `flaky` collection. */
const Things: CollectionConfig = {
  slug: 'things',
  admin: { useAsTitle: 'title' },
  hooks: {
    beforeChange: [
      ({ operation, data }) => {
        if (flags.failThingUpdates && operation === 'update') throw new Error('simulated: things are locked after create')
        return data
      },
    ],
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'status', type: 'text', validate: (v: unknown) => (v === 'boom' ? 'status may not be "boom" (simulated create failure)' : true) },
    { name: 'related', type: 'relationship', relationTo: 'things', hasMany: true },
    { name: 'flakyRef', type: 'relationship', relationTo: 'flaky' },
  ],
}

// Chickens ⇄ eggs: both relationship fields are REQUIRED, so a mutual ref is an unbreakable
// dependency cycle (the graph's hard error). Eggs' required `chicken` also drives the
// required-ref-to-skipped-definition error when the chickens definition is disabled.
const Chickens: CollectionConfig = {
  slug: 'chickens',
  admin: { useAsTitle: 'name' },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'egg', type: 'relationship', relationTo: 'eggs', required: true },
  ],
}

const Eggs: CollectionConfig = {
  slug: 'eggs',
  admin: { useAsTitle: 'name' },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'chicken', type: 'relationship', relationTo: 'chickens', required: true },
  ],
}

/** Upload collection. `flags.lockMediaDeletes` makes every delete throw — an un-clearable doc, so
 *  the clear-failure warning (with the doc's human label) can be observed. */
const Media: CollectionConfig = {
  slug: 'media',
  upload: { staticDir: resolve(currentDir, '../media') },
  hooks: {
    beforeDelete: [
      () => {
        if (flags.lockMediaDeletes) throw new Error('simulated storage outage: delete rejected')
      },
    ],
  },
  fields: [{ name: 'alt', type: 'text' }],
}

/** Always skipped at seed time — simulates a plugin collection that disables its seed when
 *  credentials are missing (e.g. payload-mux without Mux keys). */
const Flaky: CollectionConfig = {
  slug: 'flaky',
  custom: { seedDisabled: 'FLAKY_API_KEY is not set (simulated missing credentials)' },
  admin: { useAsTitle: 'title' },
  fields: [{ name: 'title', type: 'text' }],
}

/** `tagline: 'boom'` fails validation on update — the globals-last write path. */
const Settings: GlobalConfig = {
  slug: 'settings',
  fields: [
    {
      name: 'tagline',
      type: 'text',
      validate: (v: unknown) => (v === 'boom' ? 'tagline may not be "boom" (simulated global-update failure)' : true),
    },
    { name: 'featuredThing', type: 'relationship', relationTo: 'things' },
  ],
}

export default buildConfig({
  secret: process.env.PAYLOAD_SECRET || 'test-secret',
  db: sqliteAdapter({ client: { url: process.env.DATABASE_URI || 'file:./seed-failures.db' } }),
  editor: lexicalEditor(),
  telemetry: false,
  // Route ALL logging through the in-memory capture so tests can assert on the exact messages.
  logger: { options: { level: 'info' }, destination: captureDestination },
  collections: [Users, Things, Chickens, Eggs, Media, Flaky],
  globals: [Settings],
  typescript: { outputFile: resolve(currentDir, 'payload-types.ts') },
})
