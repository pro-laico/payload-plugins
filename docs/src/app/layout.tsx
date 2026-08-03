import type { Metadata } from 'next'
import { RootProvider } from 'fumadocs-ui/provider/next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { appDescription, appName, siteUrl } from '@/lib/shared'
import './global.css'

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
      <body className="flex flex-col min-h-screen font-sans">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  )
}
