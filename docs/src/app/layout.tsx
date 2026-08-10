import type { Metadata } from 'next'
import { RootProvider } from 'fumadocs-ui/provider/next'
import { GoogleTagManager } from '@next/third-parties/google'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { appDescription, appName, siteUrl } from '@/lib/shared'
import './global.css'

// The container id is public by design (it ships in every page's source), so it lives here rather
// than in env: the CLI stores project env vars as Sensitive, which the build step can't read, and
// NEXT_PUBLIC_* inlining happens at build. The VERCEL_ENV gate (read while pages prerender on
// Vercel) keeps local dev/builds and preview deploys tag-free.
const gtmId = process.env.VERCEL_ENV === 'production' ? 'GTM-KWX458DP' : undefined

const sans = Inter({ subsets: ['latin'], variable: '--font-inter' })
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains' })

const fontVars = `${sans.variable} ${mono.variable}`

// Defaults every page inherits. Pages override title / description / openGraph.url; the card shape,
// site name and image stay constant, so a shared link reads the same wherever it lands.
// `metadataBase` is what makes the relative OG image resolve — without it Next emits nothing usable
// and warns at build.
export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: { default: appName, template: `%s — ${appName}` },
  description: appDescription,
  applicationName: appName,
  openGraph: { type: 'website', siteName: appName, locale: 'en_US', url: '/', title: appName, description: appDescription },
  twitter: { card: 'summary_large_image', title: appName, description: appDescription },
}

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={fontVars} suppressHydrationWarning>
      {gtmId && <GoogleTagManager gtmId={gtmId} />}
      <body className="flex flex-col min-h-screen font-sans">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  )
}
