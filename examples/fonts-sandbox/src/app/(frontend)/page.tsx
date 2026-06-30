import config from '@payload-config'
import { type FontRole, getActiveFontFaces } from '@pro-laico/payload-fonts'
import { getPayload } from 'payload'
import { SeedControls } from '@/components/SeedControls'

// Read the active selection fresh each render so a seed/edit shows up on reload.
export const dynamic = 'force-dynamic'

const ROLE_LABEL: Record<FontRole, string> = { sans: 'Sans', serif: 'Serif', mono: 'Mono', display: 'Display' }
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const roleVar = (role: FontRole) => `var(--font-set${cap(role)})`

type ActiveEntry = { role: FontRole; title: string; files: string[] }

/** The active typefaces (role, title, served filenames) — the fonts the layout makes available as
 *  `--font-set*` variables (via `<DevFonts />` in dev, `next/font` in prod). */
async function getActive(): Promise<ActiveEntry[]> {
  const payload = await getPayload({ config })
  const faces = await getActiveFontFaces(payload)

  const titleByRole = new Map<FontRole, string>()
  try {
    const fontSet = (await payload.findGlobal({ slug: 'fontSet', depth: 1, overrideAccess: true })) as Partial<
      Record<FontRole, { title?: string } | null>
    >
    for (const role of ['sans', 'serif', 'mono', 'display'] as FontRole[]) {
      const doc = fontSet?.[role]
      if (doc && typeof doc === 'object' && doc.title) titleByRole.set(role, doc.title)
    }
  } catch {
    // no fontSet global
  }

  return faces.map((f) => ({ role: f.role, title: titleByRole.get(f.role) ?? f.role, files: f.faces.map((x) => x.filename) }))
}

const SAMPLE = 'The quick brown fox jumps over the lazy dog'

export default async function Home() {
  const active = await getActive()

  return (
    <main className="shell">
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static page chrome, no user input. */}
      <style dangerouslySetInnerHTML={{ __html: CHROME }} />

      <header>
        <h1 className="h1" style={{ fontFamily: roleVar('display') }}>
          Fonts Sandbox
        </h1>
        <p className="lead">
          Each sample below is rendered with <code>font-family: var(--font-set…)</code> — the role variables the layout exposes via{' '}
          <code>&lt;DevFonts /&gt;</code> in dev and <code>next/font</code> in production. Same CSS, both environments. If the headings render
          in distinct fonts, the whole pipeline works: upload → subset → serve → render.
        </p>
        <SeedControls />
      </header>

      {active.length === 0 ? (
        <section className="card">
          <h2 className="h2" style={{ fontFamily: roleVar('display') }}>
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
          <section key={entry.role} className="specimen">
            <div className="specimen__head">
              <span className="specimen__name" style={{ fontFamily: roleVar(entry.role) }}>
                {entry.title}
              </span>
              <span className="badge">
                {ROLE_LABEL[entry.role]} · var(--font-set{cap(entry.role)})
              </span>
            </div>
            <p className="specimen__sample" style={{ fontFamily: roleVar(entry.role) }}>
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
