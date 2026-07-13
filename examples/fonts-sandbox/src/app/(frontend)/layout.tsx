import config from '@payload-config'
import { extractFonts } from '@pro-laico/payload-fonts'
import { DevFonts } from '@pro-laico/payload-fonts/DevFonts'
import { getPayload } from 'payload'
import type React from 'react'
import definitionFonts from '@/app/definition'
import '@pro-laico/sandbox-shell/styles.css'

// Dynamic: the page reads live Payload data (seed status + the active font set) on every request.
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Fonts Sandbox',
  description: 'An example app for @pro-laico/payload-fonts.',
}

// The active fonts are applied as the `--font-set{Sans,Serif,Mono,Display}` CSS variables, two
// ways that never both fire:
//
//   • Production — `next/font/local`. `pnpm prebuild` runs `payload-fonts-download`, which writes
//     the active fonts to `src/app/definition.ts`; `extractFonts` puts their classes on <html>.
//     Stock next/font: precise preloading, size-adjusted fallbacks, static assets.
//   • Development — `<DevFonts />` reads the active selection from Payload and inlines the matching
//     @font-face + the same `--font-set*` variables at runtime, so seeding/editing shows up on
//     refresh with no build step. It renders nothing in production (and stands down if the
//     definition is populated, so `generate:fonts` lets you preview the real prod path locally).
//
// A page then just uses `font-family: var(--font-setSans)` — identical in both environments.
// Redirecting the shell's --font-sans token at the seeded sans makes the whole page part of the demo.
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
