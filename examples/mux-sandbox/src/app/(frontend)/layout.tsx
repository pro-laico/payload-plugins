import type React from 'react'

import '@pro-laico/sandbox-shell/styles.css'

export const metadata = {
  title: 'Mux Sandbox',
  description: 'An example app for @pro-laico/payload-mux.',
}

export default function FrontendLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
