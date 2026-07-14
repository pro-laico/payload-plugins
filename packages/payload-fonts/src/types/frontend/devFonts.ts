import type { Payload } from 'payload'

import type { FontFamilyConfig } from '../families/families'

export interface DevFontsProps {
  payload: Payload | Promise<Payload>
  definition?: Record<string, { variable?: string } | undefined>
  cssVarPrefix?: string
  fontSetSlug?: string
  optimizedSlug?: string
  families?: FontFamilyConfig[]
}

export type FontDefinitions = Record<string, { variable?: string } | undefined>
