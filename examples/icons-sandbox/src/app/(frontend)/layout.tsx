import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import '@pro-laico/sandbox-shell/styles.css'
import './globals.css'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Icons Sandbox', description: 'CVA + Tailwind showcase for @pro-laico/payload-icons' }

export default function FrontendLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
