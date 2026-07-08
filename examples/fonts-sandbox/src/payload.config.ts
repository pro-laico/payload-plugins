import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { buildConfig, type SharpDependency } from 'payload'
import sharp from 'sharp'
import { Users } from './collections/Users'
import { plugins } from './plugins'

const filename = fileURLToPath(import.meta.url)
const currentDir = dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: { baseDir: resolve(currentDir) },
  },
  // The `font` typeface collection + its hidden `fontOriginal`/`fontOptimized` upload
  // collections + the `fontSet` global come from fontsPlugin (see ./plugins).
  collections: [Users],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || 'dev-secret-change-me',
  typescript: { outputFile: resolve(currentDir, 'payload-types.ts') },
  db: sqliteAdapter({ client: { url: process.env.DATABASE_URI || 'file:./fonts-sandbox.db' } }),
  //TODO: drop the cast when Payload's SharpDependency catches up to sharp 0.35's input types.
  sharp: sharp as unknown as SharpDependency,
  plugins,
})
