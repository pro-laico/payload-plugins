/** One preset's serve identity: the cacheKey its URL resolves to, plus the cached variant when it exists. */
export interface PresetVariantMatch {
  name: string
  cacheKey: string
  variantId?: string | number
  filename?: string
}

/** `GET /img/presets/:id` response — every servable preset (config templates + custom entries). */
export interface PresetStatusResponse {
  presets: PresetVariantMatch[]
}
