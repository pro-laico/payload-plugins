import type { ActiveFace } from '@pro-laico/payload-fonts'

import type { ActiveEntry } from '@/types'

const SAMPLE = 'The quick brown fox jumps over the lazy dog'
const FAMILY_LABEL: Record<string, string> = { sans: 'Sans', serif: 'Serif', mono: 'Mono', display: 'Display' }

const rangeLabel = (faces: ActiveFace[]) => {
  const variable = faces.find((f) => f.weight.includes(' '))
  const italic = faces.find((f) => f.style === 'italic')
  const base = variable ? `variable wght ${variable.weight.replace(' ', '–')}` : `wght ${faces.map((f) => f.weight).join(' · ')}`
  return italic ? `${base} + italic${italic.obliqueAngle ? ` (oblique ${italic.obliqueAngle}°)` : ''}` : base
}

const sampleWeights = (faces: ActiveFace[]): number[] => {
  const upright = faces.filter((f) => f.style === 'normal')
  const variable = upright.find((f) => f.weight.includes(' '))
  if (variable) {
    const [min, max] = variable.weight.split(' ').map(Number)
    return [...new Set([min, 400, 700, max])].filter((w) => w >= min && w <= max).sort((a, b) => a - b)
  }
  return [...new Set(upright.map((f) => Number(f.weight)))].sort((a, b) => a - b)
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const familyVar = (family: string) => `var(--font-set${cap(family)})`
const italicFontStyle = (face: ActiveFace) => (face.obliqueAngle ? `oblique ${face.obliqueAngle}deg` : 'italic')

/** One typeface's specimen card: name, badge (family var + weight range), a sample line per
 *  representative weight, one italic line when the face supports it, and the served filenames.
 *  Render {@link SPECIMEN_CSS} once on the page that uses this. */
export function FontSpecimen({ entry }: { entry: ActiveEntry }) {
  return (
    <section className="shell-card">
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
  )
}

export const SPECIMEN_CSS = `
  .specimen__head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
  .specimen__name { font-size: 1.5rem; font-weight: 600; }
  .specimen__badge { font-size: 0.68rem; letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted); border: 1px solid var(--border); border-radius: 999px; padding: 3px 10px; white-space: nowrap; }
  .specimen__sample { display: flex; align-items: baseline; gap: 14px; font-size: 1.7rem; line-height: 1.25; margin: 0 0 8px; word-break: break-word; }
  .specimen__weight { flex: none; min-width: 3ch; font-family: var(--font-mono); font-size: 0.7rem; color: var(--muted); }
  .specimen__files { font-size: 0.8rem; margin: 8px 0 0; }
`
