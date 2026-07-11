/** The configured public origin from the environment — the fallback when `config.serverURL` is
 *  unset. Returns `''` when nothing is configured. */
export const getServerSideURL = (): string => {
  if (process.env.NEXT_PUBLIC_SERVER_URL) return process.env.NEXT_PUBLIC_SERVER_URL
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  return ''
}
