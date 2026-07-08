import config from '@payload-config'
import { DevToolbar, resolveDevChrome } from '@pro-laico/payload-dev-tools/toolbar'
import { extractFonts } from '@pro-laico/payload-fonts'
import { DevFonts } from '@pro-laico/payload-fonts/DevFonts'
import type { Metadata } from 'next'
import { type ReactNode, Suspense } from 'react'
import definitionFonts from '@/app/definition'
import { SiteFooter } from '@/components/SiteFooter'
import { SiteHeader } from '@/components/SiteHeader'
import { devLinks } from '@/dev/links'
import { devTests } from '@/dev/tests'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'Meridian — Design-Build Studio', template: '%s · Meridian' },
  description: 'A design-build studio working across architecture, interiors, and landscape.',
}

// The active brand fonts are applied as the `--font-set{Sans,Serif,Mono,Display}` CSS variables two
// ways that never both fire (see the fonts-sandbox for the full write-up):
//   • Production — next/font/local. `pnpm prebuild` writes the active fonts to definition.ts;
//     `extractFonts` puts their classes on <html>.
//   • Development — <DevFonts /> reads the active selection from Payload and inlines the matching
//     @font-face + `--font-set*` vars at runtime, so a seed/edit shows on refresh with no build.
//
// Cache Components: DevFonts (a runtime Payload read in dev) and the chrome slots (resolveDevChrome
// reads cookies in dev; the footer resolves icons at request time) are dynamic, so each renders
// inside its own Suspense boundary while the rest of the shell stays static.
export default function FrontendLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={extractFonts(definitionFonts)}>
      <head>
        <Suspense fallback={null}>
          <DevFonts config={config} definition={definitionFonts} />
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
        {/* Dev-only (renders null in production): the floating dev toolbar + test harness. */}
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
