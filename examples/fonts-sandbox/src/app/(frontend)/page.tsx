import config from '@payload-config'
import { getActiveFontFaces } from '@pro-laico/payload-fonts'
import { getPayload } from 'payload'
import { SeedControls } from '@/components/SeedControls'

// Read the active selection fresh each render so a seed/edit shows up on reload.
export const dynamic = 'force-dynamic'

const FAMILY_LABEL: Record<string, string> = { sans: 'Sans', serif: 'Serif', mono: 'Mono', display: 'Display' }
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const familyVar = (family: string) => `var(--font-set${cap(family)})`

type ActiveEntry = { family: string; title: string; files: string[] }

/** The active typefaces (family, title, served filenames) — the fonts the layout makes available as
 *  `--font-set*` variables (via `<DevFonts />` in dev, `next/font` in prod). */
async function getActive(): Promise<ActiveEntry[]> {
  const payload = await getPayload({ config })
  const faces = await getActiveFontFaces(payload)

  const titleByFamily = new Map<string, string>()
  try {
    const fontSet = (await payload.findGlobal({ slug: 'fontSet', depth: 1, overrideAccess: true })) as unknown as Partial<
      Record<string, { title?: string } | null>
    >
    for (const family of ['sans', 'serif', 'mono', 'display']) {
      const doc = fontSet?.[family]
      if (doc && typeof doc === 'object' && doc.title) titleByFamily.set(family, doc.title)
    }
  } catch {
    // no fontSet global
  }

  return faces.map((f) => ({ family: f.family, title: titleByFamily.get(f.family) ?? f.family, files: f.faces.map((x) => x.filename) }))
}

const SAMPLE = 'The quick brown fox jumps over the lazy dog'

export default async function Home() {
  const active = await getActive()

  return (
    <main className="shell">
      <style dangerouslySetInnerHTML={{ __html: CHROME }} />

      <header>
        <h1 className="h1" style={{ fontFamily: familyVar('display') }}>
          Fonts Sandbox
        </h1>
        <p className="lead">
          Each sample below is rendered with <code>font-family: var(--font-set…)</code> — the family variables the layout exposes via{' '}
          <code>&lt;DevFonts /&gt;</code> in dev and <code>next/font</code> in production. Same CSS, both environments. If the headings render
          in distinct fonts, the whole pipeline works: upload → subset → serve → render.
        </p>
        <SeedControls />
      </header>

      {active.length === 0 ? (
        <section className="card">
          <h2 className="h2" style={{ fontFamily: familyVar('display') }}>
            No fonts seeded yet
          </h2>
          <p className="muted">
            Click <strong>Seed the database</strong> above (needs <code>ENABLE_SEED=true</code> + an admin session), use the “Seed your
            database” button in the <a href="/admin">admin dashboard</a>, or <code>POST /api/seed</code>. The seed ingests four sample typefaces
            from <code>seed-assets/fonts/</code>, subsets each to a served WOFF2, and wires the <code>fontSet</code> global.
          </p>
        </section>
      ) : (
        active.map((entry) => (
          <section key={entry.family} className="specimen">
            <div className="specimen__head">
              <span className="specimen__name" style={{ fontFamily: familyVar(entry.family) }}>
                {entry.title}
              </span>
              <span className="badge">
                {FAMILY_LABEL[entry.family]} · var(--font-set{cap(entry.family)})
              </span>
            </div>
            <p className="specimen__sample" style={{ fontFamily: familyVar(entry.family) }}>
              {SAMPLE}
            </p>
            <p className="specimen__files">{entry.files.join(' · ')}</p>
          </section>
        ))
      )}

      <footer className="muted foot">
        In production, run <code>pnpm prebuild</code> (or <code>generate:fonts</code>) to self-host these with <code>next/font/local</code>— it
        fetches the active fonts from <code>/api/fonts/export</code> and writes <code>public/fonts/</code> + <code>definition.ts</code>. Running
        it against this dev server makes <code>&lt;DevFonts /&gt;</code> stand down so you can preview the exact production path.
      </footer>
    </main>
  )
}

const CHROME = `
  .shell { max-width: 820px; margin: 0 auto; padding: 48px 24px 96px; }
  .h1 { font-size: 2.2rem; letter-spacing: -0.02em; margin: 0 0 10px; }
  .h2 { font-size: 1.3rem; margin: 0 0 8px; }
  .lead { color: #b4b4b4; margin: 0 0 20px; max-width: 64ch; }
  .muted { color: #9a9a9a; }
  code { background: #171717; border: 1px solid #2a2a2a; padding: 1px 5px; border-radius: 4px; font-size: 0.85em; }
  .card { background: #141414; border: 1px solid #2a2a2a; border-radius: 12px; padding: 20px; margin-top: 8px; }
  .specimen { background: #141414; border: 1px solid #2a2a2a; border-radius: 12px; padding: 24px; margin-bottom: 16px; }
  .specimen__head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
  .specimen__name { font-size: 1.5rem; font-weight: 600; }
  .badge { font-size: 0.68rem; letter-spacing: 0.04em; text-transform: uppercase; color: #b4b4b4; border: 1px solid #2a2a2a; border-radius: 999px; padding: 3px 10px; white-space: nowrap; }
  .specimen__sample { font-size: 1.9rem; line-height: 1.25; margin: 0 0 10px; word-break: break-word; }
  .specimen__files { color: #7c7c7c; font-size: 0.8rem; margin: 0; }
  .foot { margin-top: 28px; font-size: 0.85rem; max-width: 64ch; }
`
