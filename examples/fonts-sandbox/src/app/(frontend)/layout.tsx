import type React from 'react'
import config from '@payload-config'
import { getPayload } from 'payload'
import { extractFonts } from '@pro-laico/payload-fonts'
import { DevFonts } from '@pro-laico/payload-fonts/DevFonts'

import definitionFonts from '@/app/definition'

import '@pro-laico/sandbox-shell/styles.css'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Fonts Sandbox', description: 'An example app for @pro-laico/payload-fonts.' }

const shellUsesSeededSans = `.sandbox-shell { --font-sans: var(--font-setSans, ui-sans-serif, system-ui, sans-serif); }`

export default function FrontendLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={extractFonts(definitionFonts)}>
      <head>
        <DevFonts payload={getPayload({ config })} definition={definitionFonts} />
        <style dangerouslySetInnerHTML={{ __html: shellUsesSeededSans }} />
      </head>
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  )
}
