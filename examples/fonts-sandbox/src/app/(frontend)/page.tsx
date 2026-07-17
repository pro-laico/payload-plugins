import config from '@payload-config'
import { Suspense } from 'react'
import { connection } from 'next/server'
import { type CollectionSlug, getPayload, type Payload } from 'payload'
import { getActiveFontFaces } from '@pro-laico/payload-fonts'
import { EmptyState, getSeedStatus, SandboxShell, SeedPanel } from '@pro-laico/sandbox-shell'

import type { ActiveEntry } from '@/types'
import { FontSpecimen, SPECIMEN_CSS } from '@/components/FontSpecimen'

const SEEDED_SLUGS: CollectionSlug[] = ['fontOriginal', 'font']

/** The active typefaces (family, title, served faces) — the fonts the layout makes available as
 *  `--font-set*` variables (this playground uses the live `<PreviewFonts />` path). */
async function getActive(payload: Payload): Promise<ActiveEntry[]> {
  const faces = await getActiveFontFaces(payload)

  const titleByFamily = new Map<string, string>()
  try {
    const fontSet = await payload.findGlobal({ slug: 'fontSet', depth: 1 })
    const familyDocs = { sans: fontSet.sans, serif: fontSet.serif, mono: fontSet.mono, display: fontSet.display }
    for (const [family, doc] of Object.entries(familyDocs)) {
      if (doc && typeof doc === 'object' && doc.title) titleByFamily.set(family, doc.title)
    }
  } catch {}

  return faces.map((f) => ({ family: f.family, title: titleByFamily.get(f.family) ?? f.family, faces: f.faces }))
}

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

/** The live, per-request part: seed status + the active specimens. `connection()` marks it dynamic,
 * so it streams into the Suspense hole instead of prerendering with build-time data. */
async function Specimens() {
  await connection()
  const payload = await getPayload({ config })
  const status = await getSeedStatus(payload, SEEDED_SLUGS)
  const active = await getActive(payload)

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
