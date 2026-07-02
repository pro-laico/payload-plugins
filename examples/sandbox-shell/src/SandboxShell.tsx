import type { CSSProperties, ReactNode } from 'react'

const REPO_URL = 'https://github.com/pro-laico/payload-plugins'

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

export function SandboxShell({ title, packageName, docsHref, accent, lead, children }: SandboxShellProps) {
  return (
    <div className="sandbox-shell" data-accent={accent} style={accent ? ({ '--accent': accent } as CSSProperties) : undefined}>
      <header className="shell-header">
        <div>
          <h1>{title}</h1>
          <span className="shell-pkg">{packageName}</span>
        </div>
        <nav>
          <a href="/admin">Admin</a>
          <a href={docsHref}>Docs</a>
          <a href={REPO_URL}>GitHub</a>
        </nav>
      </header>
      <main className="shell-main">
        {lead ? <p className="shell-lead">{lead}</p> : null}
        {children}
      </main>
      <footer className="shell-footer">
        An example app for <code>{packageName}</code> — seed it, poke it, <a href={REPO_URL}>read the source</a>.
      </footer>
    </div>
  )
}
