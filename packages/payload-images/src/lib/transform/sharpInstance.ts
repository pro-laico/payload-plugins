type SharpFactory = typeof import('sharp')['default']

let override: number | undefined
let configured = false

export const setSharpConcurrency = (n?: number): void => {
  if (n != null && Number.isFinite(n) && n >= 0) override = Math.floor(n)
}

export const loadSharp = async (): Promise<SharpFactory> => {
  const sharp = (await import('sharp')).default
  if (!configured) {
    configured = true
    const env = Number(process.env.IMAGES_SHARP_CONCURRENCY)
    const n = override ?? (Number.isFinite(env) && env >= 0 ? Math.floor(env) : 1)
    try {
      sharp.concurrency(n)
      if (process.platform === 'win32') sharp.cache({ memory: 50, files: 0, items: 100 })
    } catch {}
  }
  return sharp
}
