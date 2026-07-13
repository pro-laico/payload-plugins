import config from '@payload-config'
import { type ActiveFace, getActiveFontFaces } from '@pro-laico/payload-fonts'
import { EmptyState, getSeedStatus, SandboxShell, SeedPanel } from '@pro-laico/sandbox-shell'
import { getPayload, type Payload } from 'payload'
import type { ActiveEntry } from '@/types'

// The slugs src/seed/ fills (the seed also sets the `fontSet` global, but getSeedStatus counts
// collections — the global's effect shows up as the specimens themselves).
const SEEDED_SLUGS = ['fontOriginal', 'font']

const FAMILY_LABEL: Record<string, string> = { sans: 'Sans', serif: 'Serif', mono: 'Mono', display: 'Display' }
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const familyVar = (family: string) => `var(--font-set${cap(family)})`

/** The active typefaces (family, title, served faces) — the fonts the layout makes available as
 *  `--font-set*` variables (via `<DevFonts />` in dev, `next/font` in prod). */
async function getActive(payload: Payload): Promise<ActiveEntry[]> {
  const faces = await getActiveFontFaces(payload)

  const titleByFamily = new Map<string, string>()
  try {
    const fontSet = (await payload.findGlobal({ slug: 'fontSet', depth: 1 })) as unknown as Partial<Record<string, { title?: string } | null>>
    for (const family of ['sans', 'serif', 'mono', 'display']) {
      const doc = fontSet?.[family]
      if (doc && typeof doc === 'object' && doc.title) titleByFamily.set(family, doc.title)
    }
  } catch {
    // no fontSet global
  }

  return faces.map((f) => ({ family: f.family, title: titleByFamily.get(f.family) ?? f.family, faces: f.faces }))
}

// A variable face carries a 'min max' range in one file — sample a spread across it. Static faces
// get one sample per served upright weight.
const sampleWeights = (faces: ActiveFace[]): number[] => {
  const upright = faces.filter((f) => f.style === 'normal')
  const variable = upright.find((f) => f.weight.includes(' '))
  if (variable) {
    const [min, max] = variable.weight.split(' ').map(Number)
    return [...new Set([min, 400, 700, max])].filter((w) => w >= min && w <= max).sort((a, b) => a - b)
  }
  return [...new Set(upright.map((f) => Number(f.weight)))].sort((a, b) => a - b)
}

const rangeLabel = (faces: ActiveFace[]) => {
  const variable = faces.find((f) => f.weight.includes(' '))
  const italic = faces.find((f) => f.style === 'italic')
  const base = variable ? `variable wght ${variable.weight.replace(' ', '–')}` : `wght ${faces.map((f) => f.weight).join(' · ')}`
  return italic ? `${base} + italic${italic.obliqueAngle ? ` (oblique ${italic.obliqueAngle}°)` : ''}` : base
}

// An italic face rides `font-style: italic` (a true italic / `ital` axis) or, when it carries an
// oblique angle, the `oblique <angle>` that maps onto the file's `slnt` axis — same as the served CSS.
const italicFontStyle = (face: ActiveFace) => (face.obliqueAngle ? `oblique ${face.obliqueAngle}deg` : 'italic')

const SAMPLE = 'The quick brown fox jumps over the lazy dog'

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
        active.map((entry) => (
          <section key={entry.family} className="shell-card">
            <div className="specimen__head">
              <span className="specimen__name" style={{ fontFamily: familyVar(entry.family) }}>
                {entry.title}
              </span>
              <span className="specimen__badge">
                {FAMILY_LABEL[entry.family] ?? entry.family} · var(--font-set{cap(entry.family)}) · {rangeLabel(entry.faces)}
              </span>
            </div>
            {sampleWeights(entry.faces).map((weight) => (
              <p key={weight} className="specimen__sample" style={{ fontFamily: familyVar(entry.family), fontWeight: weight }}>
                <span className="specimen__weight">{weight}</span> {SAMPLE}
              </p>
            ))}
            {entry.faces
              .filter((f) => f.style === 'italic')
              .slice(0, 1)
              .map((face) => (
                <p key="italic" className="specimen__sample" style={{ fontFamily: familyVar(entry.family), fontStyle: italicFontStyle(face) }}>
                  <span className="specimen__weight">italic</span> {SAMPLE}
                </p>
              ))}
            <p className="specimen__files shell-muted">{[...new Set(entry.faces.map((f) => f.filename))].join(' · ')}</p>
          </section>
        ))
      )}

      <p className="shell-muted" style={{ fontSize: '0.85rem', maxWidth: '72ch' }}>
        In production, run <code>pnpm prebuild</code> (or <code>generate:fonts</code>) to self-host these with <code>next/font/local</code> — it
        fetches the active fonts from <code>/api/fonts/export</code> and writes <code>public/fonts/</code> + <code>definition.ts</code>. Running
        it against this dev server makes <code>&lt;DevFonts /&gt;</code> stand down so you can preview the exact production path.
      </p>
    </SandboxShell>
  )
}

// Specimen-specific type styles only — cards, buttons, and colors come from the shell.
const SPECIMEN_CSS = `
  .specimen__head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
  .specimen__name { font-size: 1.5rem; font-weight: 600; }
  .specimen__badge { font-size: 0.68rem; letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted); border: 1px solid var(--border); border-radius: 999px; padding: 3px 10px; white-space: nowrap; }
  .specimen__sample { display: flex; align-items: baseline; gap: 14px; font-size: 1.7rem; line-height: 1.25; margin: 0 0 8px; word-break: break-word; }
  .specimen__weight { flex: none; min-width: 3ch; font-family: var(--font-mono); font-size: 0.7rem; color: var(--muted); }
  .specimen__files { font-size: 0.8rem; margin: 8px 0 0; }
`
