/**
 * Lazy Sharp loader with one-time global tuning. Each transform defaults to a single libvips
 * thread ({@link withTransformLimit} already provides cross-image parallelism) to bound memory
 * on serverless; override via the endpoint's `sharpConcurrency` or `IMAGES_SHARP_CONCURRENCY`
 * (`0` = Sharp's default, CPU cores). On Windows the libvips file-descriptor cache is disabled:
 * libvips keeps recently-read files OPEN and Windows can't unlink an open file, so a transformed
 * original would otherwise block its own deletion (reseed, replaced upload) for the process's life.
 */
type SharpFactory = typeof import('sharp')['default']

let override: number | undefined
let configured = false

/** Set the per-image libvips thread cap applied on the next Sharp load (negative ignored). */
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
