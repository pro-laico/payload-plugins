import type { EndpointAccess } from '../../_kit'

export interface PurgeEndpointConfig {
  variantSlug?: string
  sourceSlug?: string
  access?: EndpointAccess
}

export interface PurgeOptions {
  variantSlug?: string
}
