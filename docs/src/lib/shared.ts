export const appName = 'Payload Plugins'
export const appDescription = 'Composable Payload CMS plugins published under the @pro-laico/* scope.'
export const docsRoute = '/docs'

/** Absolute origin, which link previews and sitemaps both require — a relative OG image resolves to
 * nothing in Slack or on X. Vercel supplies the deployment host, so preview builds advertise
 * themselves rather than production; locally it tracks the dev port, so previews are checkable. */
export const siteUrl = new URL(
  process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_ENV === 'production'
      ? 'https://payload-plugins.prolaico.com'
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : `http://localhost:${process.env.PORT ?? 43210}`),
)

export const gitConfig = {
  user: 'pro-laico',
  repo: 'payload-plugins',
  branch: 'main',
}

export const githubUrl = `https://github.com/${gitConfig.user}/${gitConfig.repo}`
