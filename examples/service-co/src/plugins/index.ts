import { fontsPlugin } from '@pro-laico/payload-fonts'
import { iconsPlugin } from '@pro-laico/payload-icons'
import { imagesPlugin } from '@pro-laico/payload-images'
import { muxVideoPlugin } from '@pro-laico/payload-mux'
import { seedPlugin } from '@pro-laico/payload-seed'
import type { Plugin } from 'payload'
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

// Mux needs real credentials to ingest a clip, so the video seed only runs when they're present.
// Everything else seeds offline. Nothing else in the seed references `mux-video` (attach the clip
// to a project's Video / Site Settings → Showreel in the admin), which keeps the seed-ref types the
// dev server regenerates on boot stable whether or not creds are set.
const withMux = Boolean(process.env.MUX_TOKEN_ID)

// Every seed definition, handed to the seed plugin (which powers the admin "Seed your database"
// button, POST /api/seed, and `pnpm seed`) and re-exported for the integration test. The engine
// orders these by their `ref()` edges — array order here is just for reading.
export const seedDefinitions = [
  fontOriginals,
  fonts,
  fontSet,
  icons,
  iconSets,
  images,
  services,
  projects,
  team,
  testimonials,
  siteSettings,
  ...(withMux ? [videos] : []),
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
export const plugins: Plugin[] = [
  imagesPlugin(),
  iconsPlugin(),
  muxVideoPlugin(),
  fontsPlugin(),
  seedPlugin({ adminButton: true, ...seedOptions }),
]
