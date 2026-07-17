import type React from 'react'
import config from '@payload-config'
import { getPayload } from 'payload'
import { Suspense } from 'react'
import { PreviewFonts } from '@pro-laico/payload-fonts/PreviewFonts'

import '@pro-laico/sandbox-shell/styles.css'

// This sandbox is a font playground, so it takes the LIVE path: <PreviewFonts> reads the current
// selection from the DB on every render (change a font in the admin, refresh, see it). A real site
// ships the baked path instead — `payload fonts:download` + extractFonts on <html> — which service-co
// demonstrates. The live read is a dynamic hole inside <Suspense>, so the shell still prerenders.

export const metadata = { title: 'Fonts Sandbox', description: 'An example app for @pro-laico/payload-fonts.' }

const shellUsesSeededSans = `.sandbox-shell { --font-sans: var(--font-setSans, ui-sans-serif, system-ui, sans-serif); }`

export default function FrontendLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <Suspense fallback={null}>
          <PreviewFonts payload={getPayload({ config })} />
        </Suspense>
        <style dangerouslySetInnerHTML={{ __html: shellUsesSeededSans }} />
      </head>
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  )
}
