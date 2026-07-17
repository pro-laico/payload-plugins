import type React from 'react'

import '@pro-laico/sandbox-shell/styles.css'

export const metadata = {
  title: 'Images Sandbox',
  description: 'An example app for @pro-laico/payload-images.',
}

export default function FrontendLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
