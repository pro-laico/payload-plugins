import type { Metadata } from 'next'
import { RootProvider } from 'fumadocs-ui/provider/next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './global.css'

const sans = Inter({ subsets: ['latin'], variable: '--font-inter' })
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains' })

const fontVars = `${sans.variable} ${mono.variable}`

export const metadata: Metadata = {
  title: { default: 'Payload Plugins', template: '%s — Payload Plugins' },
  description: 'Composable Payload CMS plugins published under the @pro-laico/* scope.',
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
