import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { buildConfig, type SharpDependency } from 'payload'
import sharp from 'sharp'
import { Projects } from './collections/Projects'
import { Services } from './collections/Services'
import { TeamMembers } from './collections/TeamMembers'
import { Testimonials } from './collections/Testimonials'
import { Users } from './collections/Users'
import { SiteSettings } from './globals/SiteSettings'
import { plugins } from './plugins'

const filename = fileURLToPath(import.meta.url)
const currentDir = dirname(filename)

// The site URL — used for admin CSRF/CORS, the fonts export endpoint, and (as the default)
// the Mux CORS origin. Keep it in sync with the `dev` port (3060).
const serverURL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3060'

// Meridian — a fictional design-build studio. This one config wires all six @pro-laico plugins
// together: payload-images (Projects/Services/Team photos), payload-icons (Service icons + the
// active icon set), payload-mux (the optional showreel + project video), payload-fonts (the brand
// typography), payload-seed (which fills every collection above from `src/seed/`), and
// payload-revalidate (surgical cache busts for the atomic getters in `src/lib/data.ts`). The plugin
// collections/globals (`images`, `icon`, `iconSet`, `mux-video`, `font*`, `fontSet`) are injected
// by `plugins` — only the app's own content collections are listed here.
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
  // Required by payload-images' transform endpoint (and Payload's own image processing).
  //TODO: drop the cast when Payload's SharpDependency catches up to sharp 0.35's input types.
  sharp: sharp as unknown as SharpDependency,
  plugins,
})
