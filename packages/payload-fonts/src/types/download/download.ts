export type Family = string

export type RunDownloadFontsOptions = {
  fontsOutputDir?: string
  definitionFile?: string
  envFile?: string
  localFontSrcPrefix?: string
  cssVariablePrefix?: string
  siteUrl?: string
  endpointPath?: string
  verbose?: boolean
}

export type WeightFile = { path: string; weight: string; style: string }
