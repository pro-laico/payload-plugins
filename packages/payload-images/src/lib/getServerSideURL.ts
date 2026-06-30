/**
 * The configured public origin from the environment, used by the transform endpoint as a
 * fallback when reading an original served from a relative/cloud URL. Prefer Payload's own
 * `config.serverURL` (the endpoint checks that first); this only covers the case where it's
 * unset. Returns `''` when nothing is configured, so callers can fall back to `req.origin`.
 */
export const getServerSideURL = (): string => {
  if (process.env.NEXT_PUBLIC_SERVER_URL) return process.env.NEXT_PUBLIC_SERVER_URL
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  return ''
}
