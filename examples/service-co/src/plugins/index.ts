import { devToolsPlugin } from '@pro-laico/payload-dev-tools'
import { fontsPlugin } from '@pro-laico/payload-fonts'
import { iconsPlugin } from '@pro-laico/payload-icons'
import { imagesPlugin } from '@pro-laico/payload-images'
import { muxVideoPlugin } from '@pro-laico/payload-mux'
import { seedPlugin } from '@pro-laico/payload-seed'
import type { Plugin } from 'payload'
import folders from '../seed/folders'
import fonts, { fontOriginals } from '../seed/fonts'
import fontSet from '../seed/fontSet'
import iconSets from '../seed/iconSets'
import icons from '../seed/icons'
import images from '../seed/images'
import projects from '../seed/projects'
import services from '../seed/services'
import siteSettings from '../seed/siteSettings'
import team from '../seed/team'
import testimonials from '../seed/testimonials'
import videos from '../seed/videos'

// Every seed definition, handed to the seed plugin (which powers the admin "Seed your database"
// button, POST /api/seed, and `pnpm seed`) and re-exported for the integration test. The engine
// orders these by their `ref()` edges — array order here is just for reading. `videos` is always
// registered (so the seed-ref types are stable), but Mux needs real credentials to ingest a clip:
// without MUX_TOKEN_ID / MUX_TOKEN_SECRET the plugin marks the collection seed-disabled, the engine
// skips the definition with a warning and drops the refs that point at it (Site Settings →
// Showreel). Set the env vars and the next seed fills everything in — nothing else to touch.
export const seedDefinitions = [
  fontOriginals,
  fonts,
  fontSet,
  icons,
  iconSets,
  folders,
  images,
  services,
  projects,
  team,
  testimonials,
  siteSettings,
  videos,
]

// The seed options, shared by the seed plugin below and the integration test — so the test drives
// the exact same seed the admin button / POST /api/seed / `pnpm seed` runs.
export const seedOptions = {
  definitions: seedDefinitions,
  assetsDir: 'seed-assets',
  assetSubDirs: { fontOriginal: 'font' },
}

// The project's plugin barrel — payload.config imports this array. Each plugin is zero-config:
//
//   • imagesPlugin  — the `images` collection (stores the original, generates + crops every size
//                     on demand) plus `generated-images`. Photos across the site come from here.
//   • iconsPlugin   — the `icon` SVG-upload collection (optimize + sanitize + currentColor on save)
//                     and the `iconSet` collection. `<Icon name>` resolves through the active set.
//   • muxVideoPlugin— the `mux-video` collection; reads the standard MUX_* env vars, no-op without
//                     them. cors_origin defaults to NEXT_PUBLIC_SERVER_URL.
//   • fontsPlugin   — the `font` typeface collection (subsets uploads to served WOFF2), the hidden
//                     `fontOriginal`/`fontOptimized` stores, the `fontSet` global, and the export
//                     endpoint. The brand fonts come from here.
//   • seedPlugin    — fills all of the above from `src/seed/`; `assetsDir` points at `seed-assets/`
//                     and `assetSubDirs` maps the `fontOriginal` slug to the friendlier `font/`.
//   • devToolsPlugin— dev-only `GET /api/dev` snapshot + stage endpoints (404 in production),
//                     feeding the floating <DevToolbar> mounted in the frontend layout.
export const plugins: Plugin[] = [
  // `folders: true` opts the images collection into Payload's native folder organization — the
  // seed files the photos into Site/Services/Projects/Team folders (see seed/folders.ts).
  imagesPlugin({ folders: true }),
  iconsPlugin(),
  muxVideoPlugin(),
  fontsPlugin(),
  seedPlugin({ adminButton: true, ...seedOptions }),
  devToolsPlugin(),
]
