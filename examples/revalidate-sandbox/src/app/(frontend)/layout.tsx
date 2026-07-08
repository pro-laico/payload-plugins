import type React from 'react'
import '@pro-laico/sandbox-shell/styles.css'
import { DevToolbar } from '@pro-laico/payload-dev-tools/toolbar'

export const metadata = {
  title: 'Revalidate Sandbox',
  description: 'An example app for @pro-laico/payload-revalidate.',
}

// A second root layout (alongside the Payload admin's own at (payload)/layout.tsx) — route
// groups let each top-level section own its <html>. No `force-dynamic` here: this app runs
// Cache Components, so cached and dynamic content declare themselves per component.
export default function FrontendLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <DevToolbar />
      </body>
    </html>
  )
}
