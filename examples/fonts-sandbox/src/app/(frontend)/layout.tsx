import config from '@payload-config'
import { extractFonts } from '@pro-laico/payload-fonts'
import { DevFonts } from '@pro-laico/payload-fonts/DevFonts'
import type React from 'react'
import definitionFonts from '@/app/definition'

export const metadata = {
  title: 'Fonts Sandbox',
  description: 'A minimal Payload app for testing the @pro-laico/payload-fonts plugin.',
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
const demoChrome = `
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; font-family: var(--font-setSans, ui-sans-serif), system-ui, sans-serif; background: #0a0a0a; color: #ededed; line-height: 1.5; -webkit-font-smoothing: antialiased; }
  a { color: #4ade80; }
`

export default function FrontendLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={extractFonts(definitionFonts)}>
      <head>
        <DevFonts config={config} definition={definitionFonts} />
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static demo chrome, no user input. */}
        <style dangerouslySetInnerHTML={{ __html: demoChrome }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
