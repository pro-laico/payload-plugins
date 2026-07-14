import sharp from 'sharp'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { buildConfig, type SharpDependency } from 'payload'
import { plugins } from './plugins'
import { Users } from './collections/Users'
import { Projects } from './collections/Projects'
import { Services } from './collections/Services'
import { SiteSettings } from './globals/SiteSettings'
import { TeamMembers } from './collections/TeamMembers'
import { Testimonials } from './collections/Testimonials'

const filename = fileURLToPath(import.meta.url)
const currentDir = dirname(filename)

const serverURL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3060'

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: { baseDir: resolve(currentDir) },
  },
  collections: [Users, Services, Projects, TeamMembers, Testimonials],
  globals: [SiteSettings],
  editor: lexicalEditor(),
  serverURL,
  cors: [serverURL],
  csrf: [serverURL],
  secret: process.env.PAYLOAD_SECRET || 'dev-secret-change-me',
  typescript: { outputFile: resolve(currentDir, 'payload-types.ts') },
  db: sqliteAdapter({ client: { url: process.env.DATABASE_URI || 'file:./service-co.db' } }),
  //TODO: drop the cast when Payload's SharpDependency catches up to sharp 0.35's input types.
  sharp: sharp as unknown as SharpDependency,
  plugins,
})
