import config from '@payload-config'
import type { Metadata } from 'next'
import { getPayload } from 'payload'
import { type ReactNode, Suspense } from 'react'
import { extractFonts } from '@pro-laico/payload-fonts'
import { DevFonts } from '@pro-laico/payload-fonts/DevFonts'
import { DevToolbar, resolveDevChrome } from '@pro-laico/payload-dev-tools/toolbar'

import { devLinks } from '@/dev/links'
import { devTests } from '@/dev/tests'
import definitionFonts from '@/app/definition'
import { SiteFooter } from '@/components/SiteFooter'
import { SiteHeader } from '@/components/SiteHeader'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'Meridian — Design-Build Studio', template: '%s · Meridian' },
  description: 'A design-build studio working across architecture, interiors, and landscape.',
}

export default function FrontendLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={extractFonts(definitionFonts)}>
      <head>
        <Suspense fallback={null}>
          <DevFonts payload={getPayload({ config })} definition={definitionFonts} />
        </Suspense>
      </head>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <Suspense fallback={<div className="h-16 border-b border-border/70" />}>
          <Chrome slot="header" />
        </Suspense>
        <main>{children}</main>
        <Suspense fallback={null}>
          <Chrome slot="footer" />
        </Suspense>
        <DevToolbar tests={devTests} links={devLinks} />
      </body>
    </html>
  )
}

/** Dev-only chrome swap: a header/footer-kind test selected in the dev toolbar replaces the real
 *  chrome site-wide until reset. In production this returns the real components untouched. */
async function Chrome({ slot }: { slot: 'header' | 'footer' }) {
  const { header, footer } = await resolveDevChrome({ tests: devTests, header: <SiteHeader />, footer: <SiteFooter /> })
  return slot === 'header' ? header : footer
}
