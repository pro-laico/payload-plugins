import config from '@payload-config'
import { type CollectionSlug, getPayload, type Payload } from 'payload'
import { getActiveFontFaces } from '@pro-laico/payload-fonts'
import { EmptyState, getSeedStatus, SandboxShell, SeedPanel } from '@pro-laico/sandbox-shell'

import type { ActiveEntry } from '@/types'
import { FontSpecimen, SPECIMEN_CSS } from '@/components/FontSpecimen'

const SEEDED_SLUGS: CollectionSlug[] = ['fontOriginal', 'font']

/** The active typefaces (family, title, served faces) — the fonts the layout makes available as
 *  `--font-set*` variables (via `<DevFonts />` in dev, `next/font` in prod). */
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

export default async function Home() {
  const payload = await getPayload({ config })
  const status = await getSeedStatus(payload, SEEDED_SLUGS)
  const active = await getActive(payload)

  return (
    <SandboxShell
      title="Fonts Sandbox"
      packageName="@pro-laico/payload-fonts"
      docsHref="https://payload-plugins.prolaico.com/docs/plugins/payload-fonts"
      accent="oklch(0.78 0.14 75)"
      lead={
        <>
          Each specimen below is rendered with <code>font-family: var(--font-set…)</code> — the family variables the layout exposes via{' '}
          <code>&lt;DevFonts /&gt;</code> in dev and <code>next/font</code> in production. Same CSS, both environments. If the specimens render
          in distinct fonts at distinct weights, the whole pipeline works: upload → subset → serve → render.
        </>
      }
    >
      <style dangerouslySetInnerHTML={{ __html: SPECIMEN_CSS }} />

      <SeedPanel seeded={status.seeded} counts={status.counts} />

      {active.length === 0 ? (
        <EmptyState>
          No fonts seeded yet — seed above. The seed ingests five sample typefaces from <code>seed-assets/font/</code> (including a variable
          Inter, a two-weight Lora, and an ital-capable Recursive), subsets each to a served WOFF2, and wires the <code>fontSet</code> global.
        </EmptyState>
      ) : (
        active.map((entry) => <FontSpecimen entry={entry} key={entry.family} />)
      )}

      <p className="shell-muted" style={{ fontSize: '0.85rem', maxWidth: '72ch' }}>
        In production, run <code>pnpm prebuild</code> (or <code>generate:fonts</code>) to self-host these with <code>next/font/local</code> — it
        fetches the active fonts from <code>/api/fonts/export</code> and writes <code>public/fonts/</code> + <code>definition.ts</code>. Running
        it against this dev server makes <code>&lt;DevFonts /&gt;</code> stand down so you can preview the exact production path.
      </p>
    </SandboxShell>
  )
}
