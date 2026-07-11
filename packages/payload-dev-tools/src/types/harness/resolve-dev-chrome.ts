import type { ReactNode } from 'react'
import type { Test } from './harness'

export type ResolveDevChromeOptions = {
  /** The same test array the `<DevToolbar>` receives — only `header`/`footer`-kind tests apply. */
  tests: Test[]
  /** The host's REAL `<SiteHeader />` — rendered whenever no header override is selected. */
  header: ReactNode
  /** The host's REAL `<SiteFooter />`. */
  footer: ReactNode
  /** Force on/off. Defaults to `NODE_ENV === 'development'` — in production the real chrome is
   *  returned untouched, cookies never read. */
  enabled?: boolean
}
