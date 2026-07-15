import sharp from 'sharp'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { buildConfig } from 'payload'
import { lexicalEditor } from '@payloadcms/richtext-lexical'

import { plugins } from './plugins'
import { Media } from './collections/Media'
import { Posts } from './collections/Posts'
import { Users } from './collections/Users'
import { Services } from './collections/Services'
import { SiteSettings } from './globals/SiteSettings'

const filename = fileURLToPath(import.meta.url)
const currentDir = dirname(filename)

export default buildConfig({
  admin: { user: Users.slug, importMap: { baseDir: resolve(currentDir) } },
  collections: [Users, Media, Services, Posts],
  globals: [SiteSettings],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || 'dev-secret-change-me',
  typescript: { outputFile: resolve(currentDir, 'payload-types.ts') },
  db: sqliteAdapter({ client: { url: process.env.DATABASE_URI || 'file:./revalidate-sandbox.db' } }),
  sharp,
  plugins,
})
