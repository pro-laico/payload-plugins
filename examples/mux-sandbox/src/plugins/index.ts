import type { Plugin } from 'payload'
import { seedPlugin } from '@pro-laico/payload-seed'
import { muxVideoPlugin } from '@pro-laico/payload-mux'

import pages from '../seed/pages'
import videos from '../seed/videos'

export const plugins: Plugin[] = [muxVideoPlugin(), seedPlugin({ definitions: [videos, pages], assetsDir: 'seed-assets' })]
