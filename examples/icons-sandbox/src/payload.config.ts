import sharp from 'sharp'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { buildConfig } from 'payload'
import { lexicalEditor } from '@payloadcms/richtext-lexical'

import { plugins } from './plugins'
import { Pages } from './collections/Pages'
import { Users } from './collections/Users'

const filename = fileURLToPath(import.meta.url)
const currentDir = dirname(filename)

export default buildConfig({
  admin: { user: Users.slug, importMap: { baseDir: resolve(currentDir) } },
  collections: [Users, Pages],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || 'dev-secret-change-me',
  typescript: { outputFile: resolve(currentDir, 'payload-types.ts') },
  // Dev pushes the schema; nothing here self-migrates. These apps hold nothing but seed data, so
  // `prebuild` seeds — which boots Payload outside production, pushing the schema on the way and
  // giving `next build` real content to prerender. Change the seed, reseed; there is no migration.
  db: sqliteAdapter({ client: { url: process.env.DATABASE_URI || 'file:./icons-sandbox.db' } }),
  sharp,
  plugins,
})
