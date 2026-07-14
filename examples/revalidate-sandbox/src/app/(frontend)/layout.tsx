import type React from 'react'
import { DevToolbar } from '@pro-laico/payload-dev-tools/toolbar'

import '@pro-laico/sandbox-shell/styles.css'

export const metadata = {
  title: 'Revalidate Sandbox',
  description: 'An example app for @pro-laico/payload-revalidate.',
}

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
