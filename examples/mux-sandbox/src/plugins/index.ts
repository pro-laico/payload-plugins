import type { Plugin } from 'payload'
import { seedPlugin } from '@pro-laico/payload-seed'
import { muxPlugin } from '@pro-laico/payload-mux'

import pages from '../seed/pages'
import videos from '../seed/videos'

export const plugins: Plugin[] = [muxPlugin(), seedPlugin({ definitions: [videos, pages], options: { assetsDir: 'seed-assets' } })]
