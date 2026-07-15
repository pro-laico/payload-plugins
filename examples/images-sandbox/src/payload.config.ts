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

const serverURL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:31052'

export default buildConfig({
  admin: { user: Users.slug, importMap: { baseDir: resolve(currentDir) } },
  collections: [Users, Pages],
  editor: lexicalEditor(),
  serverURL,
  secret: process.env.PAYLOAD_SECRET || 'dev-secret-change-me',
  typescript: { outputFile: resolve(currentDir, 'payload-types.ts') },
  db: sqliteAdapter({ client: { url: process.env.DATABASE_URI || 'file:./images-sandbox.db' } }),
  sharp,
  plugins,
})
