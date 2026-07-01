import config from '@payload-config'
import { extractFonts } from '@pro-laico/payload-fonts'
import { DevFonts } from '@pro-laico/payload-fonts/DevFonts'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import definitionFonts from '@/app/definition'
import { SiteFooter } from '@/components/SiteFooter'
import { SiteHeader } from '@/components/SiteHeader'
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
export default function FrontendLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={extractFonts(definitionFonts)}>
      <head>
        <DevFonts config={config} definition={definitionFonts} />
      </head>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  )
}
