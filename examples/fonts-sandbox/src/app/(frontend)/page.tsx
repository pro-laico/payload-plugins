import { Suspense } from 'react'
import { EmptyState, SandboxShell, SeedPanel } from '@pro-laico/sandbox-shell'

import { getActive, getStatus } from '@/lib/getters'
import { FontSpecimen, SPECIMEN_CSS } from '@/components/FontSpecimen'

export default function Home() {
  return (
    <SandboxShell
      title="Fonts Sandbox"
      packageName="@pro-laico/payload-fonts"
      docsHref="https://payload-plugins.prolaico.com/docs/plugins/payload-fonts"
      accent="oklch(0.78 0.14 75)"
      lead={
        <>
          Each specimen below is rendered with <code>font-family: var(--font-set…)</code> — the family variables the layout exposes via{' '}
          <code>&lt;PreviewFonts /&gt;</code>, which reads the live selection from the database on every render. If the specimens render in
          distinct fonts at distinct weights, the whole pipeline works: upload → subset → serve → render.
        </>
      }
    >
      <style dangerouslySetInnerHTML={{ __html: SPECIMEN_CSS }} />

      {/* Live reads are a dynamic hole inside Suspense — the shell around them prerenders. */}
      <Suspense fallback={<p className="shell-muted">Loading fonts…</p>}>
        <Specimens />
      </Suspense>

      <p className="shell-muted" style={{ fontSize: '0.85rem', maxWidth: '72ch' }}>
        This playground serves fonts live. To ship the production path instead, run <code>pnpm generate:fonts</code> (
        <code>payload fonts:download</code>) — it reads the active selection straight from the database (no running site) and self-hosts it with{' '}
        <code>next/font/local</code>, writing <code>public/fonts/</code> + <code>definition.ts</code>. Then put{' '}
        <code>extractFonts(definition)</code> on <code>&lt;html&gt;</code> and drop <code>&lt;PreviewFonts /&gt;</code>, as{' '}
        <code>service-co</code> does.
      </p>
    </SandboxShell>
  )
}

/** Seed status and the active specimens through cached getters — read per change, not per request. */
async function Specimens() {
  const [status, active] = await Promise.all([getStatus(), getActive()])

  return (
    <>
      <SeedPanel seeded={status.seeded} counts={status.counts} />
      {active.length === 0 ? (
        <EmptyState>
          No fonts seeded yet — seed above. The seed ingests five sample typefaces from <code>seed-assets/font/</code> (including a variable
          Inter, a two-weight Lora, and an ital-capable Recursive), subsets each to a served WOFF2, and wires the <code>fontSet</code> global.
        </EmptyState>
      ) : (
        active.map((entry) => <FontSpecimen entry={entry} key={entry.family} />)
      )}
    </>
  )
}
