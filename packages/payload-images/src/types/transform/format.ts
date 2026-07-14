export type Fit = 'cover' | 'contain' | 'inside' | 'outside' | 'fill'
export type Format = 'auto' | 'avif' | 'webp' | 'jpeg' | 'png'
export type OutputFormat = Exclude<Format, 'auto'>
