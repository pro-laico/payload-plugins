import type { ReactNode } from 'react'

export type SandboxShellProps = {
  title: string
  /** e.g. '@pro-laico/payload-seed' — rendered mono under the title. */
  packageName: string
  /** Absolute URL to the plugin's docs page. */
  docsHref: string
  /** Any CSS color (the sandboxes use oklch). Falls back to the stylesheet default when omitted. */
  accent?: string
  /** One-sentence intro rendered under the header. */
  lead?: ReactNode
  children: ReactNode
}
