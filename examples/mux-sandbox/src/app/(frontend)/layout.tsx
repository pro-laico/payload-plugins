import type React from 'react'
import '@pro-laico/sandbox-shell/styles.css'

// Dynamic: the page reads live Payload data (seed status + seeded videos) on every request.
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Mux Sandbox',
  description: 'An example app for @pro-laico/payload-mux.',
}

// A second root layout (alongside the Payload admin's own at (payload)/layout.tsx) — route
// groups let each top-level section own its <html>.
export default function FrontendLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
