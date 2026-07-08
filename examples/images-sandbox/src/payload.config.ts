import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { buildConfig, type SharpDependency } from 'payload'
import sharp from 'sharp'
import { Pages } from './collections/Pages'
import { Users } from './collections/Users'
import { plugins } from './plugins'

const filename = fileURLToPath(import.meta.url)
const currentDir = dirname(filename)

const serverURL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:31052'

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: { baseDir: resolve(currentDir) },
  },
  collections: [Users, Pages],
  editor: lexicalEditor(),
  serverURL,
  secret: process.env.PAYLOAD_SECRET || 'dev-secret-change-me',
  typescript: { outputFile: resolve(currentDir, 'payload-types.ts') },
  db: sqliteAdapter({ client: { url: process.env.DATABASE_URI || 'file:./images-sandbox.db' } }),
  // Required by the transform endpoint (and Payload's own image processing).
  //TODO: drop the cast when Payload's SharpDependency catches up to sharp 0.35's input types.
  sharp: sharp as unknown as SharpDependency,
  plugins,
})
