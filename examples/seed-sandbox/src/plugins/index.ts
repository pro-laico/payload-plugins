import type { Plugin } from 'payload'
import { seedPlugin } from '@pro-laico/payload-seed'

import mediaSeed from '../seed/media'
import postsSeed from '../collections/Posts/seed'
import servicesSeed from '../collections/Services/seed'
import siteSettingsSeed from '../globals/SiteSettings/seed'

export const plugins: Plugin[] = [seedPlugin({ definitions: [mediaSeed, servicesSeed, postsSeed, siteSettingsSeed], adminButton: true })]
