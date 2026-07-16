import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { iconsPlugin } from '@pro-laico/payload-icons'
import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { bootLab, type LabBoot } from '@/boot'
import { clearLogs, logs, warnMessages } from '@/logCapture'
import { createReport } from './report'

// payload-icons failure paths. The big one: a BROKEN SVG saves successfully — the doc gets an
// `optimized` report string and no `svgString` (it will never render), with a logger.error as the
// only loud signal. Malicious SVGs don't error at all (sanitized by design). Icon-name misses at
// render time surface as a dev-only console.warn diagnosis.

const record = createReport('payload-icons')

let lab: LabBoot
let payload: Payload
let dir: string

const createIcon = async (name: string, svg: string) => {
  const data = Buffer.from(svg)
  return (await payload.create({
    collection: 'icon' as never,
    data: {} as never,
    file: { name, data, mimetype: 'image/svg+xml', size: data.byteLength },
  })) as unknown as { id: string | number; svgString?: string; optimized?: string }
}

const errorMessages = (): string[] => logs.filter((l) => l.level === 50).map((l) => l.msg)

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'failure-lab-icons-'))
  lab = await bootLab({ plugins: [iconsPlugin({ collections: { icon: { upload: { staticDir: join(dir, 'icon') } } } })] })
  payload = lab.payload
}, 60_000)

afterAll(async () => {
  await lab?.cleanup()
  rmSync(dir, { recursive: true, force: true })
})

describe('SVG processing failures (the save SUCCEEDS — the doc carries the report)', () => {
  it('an unparseable SVG saves WITHOUT an svgString — the icon will never render', async () => {
    clearLogs()
    // Undeclared xlink: namespace — svgo throws on this.
    const doc = await createIcon('broken.svg', '<svg viewBox="0 0 24 24"><a xlink:href="#x"><path d="M0 0"/></a></svg>')
    expect(doc.id).toBeTruthy() // silent-ish success…
    expect(doc.svgString).toBeFalsy() // …that can never render
    expect(doc.optimized).toContain('Optimization failed:')
    expect(doc.optimized).toContain('icon will not render')
    const err = errorMessages().find((m) => m.includes('[payload-icons]'))
    expect(err).toContain('Error processing SVG')
    record('unparseable SVG (save succeeds!)', `doc.optimized: ${doc.optimized}`, err)
  })

  it('a stroke-based icon saves with a will-render-filled warning on the doc AND in the log', async () => {
    clearLogs()
    const doc = await createIcon(
      'stroke.svg',
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/></svg>',
    )
    expect(doc.optimized).toContain('stroke-based icon detected')
    expect(doc.optimized).toContain('Use a fill-based glyph')
    record('stroke-based icon', `doc.optimized: ${doc.optimized}`)
  })

  it('transform/clip-path skips optimization (scripts still stripped) — reported on the doc', async () => {
    clearLogs()
    const doc = await createIcon(
      'transformed.svg',
      '<svg viewBox="0 0 24 24"><g transform="rotate(45 12 12)"><path d="M4 4h16v16H4z" fill="#000"/></g></svg>',
    )
    expect(doc.optimized).toContain('Skipped optimization')
    expect(doc.svgString).toBeTruthy() // still renders — just untightened
    const warn = warnMessages().find((w) => w.includes('Unsupported SVG features'))
    expect(warn).toBeTruthy()
    record('transform present — optimization skipped', `doc.optimized: ${doc.optimized}`, warn)
  })

  it('a MALICIOUS SVG does not error at all — scripts/handlers are silently stripped (by design)', async () => {
    const doc = await createIcon(
      'malicious.svg',
      '<svg viewBox="0 0 24 24" onclick="alert(1)"><script>alert(2)</script><path d="M4 4h16v16H4z" fill="#ff0000"/><a href="javascript:alert(3)"><path d="M0 0h2v2H0z"/></a></svg>',
    )
    expect(doc.svgString).toBeTruthy()
    expect(doc.svgString).not.toContain('<script')
    expect(doc.svgString).not.toContain('onclick')
    expect(doc.svgString).not.toContain('javascript:')
    record('malicious SVG (sanitized, NO error surfaced — by design)', `stored svgString: ${doc.svgString?.slice(0, 120)}…`)
  })

  it('a non-SVG MIME type is rejected up front by the upload allowlist (Payload-core message)', async () => {
    const data = Buffer.from('just text')
    const err = await payload
      .create({
        collection: 'icon' as never,
        data: {} as never,
        file: { name: 'not-an-icon.txt', data, mimetype: 'text/plain', size: data.byteLength },
      })
      .then(
        () => undefined,
        (e: Error) => e,
      )
    expect(err).toBeTruthy()
    record('wrong MIME into icon', err?.message)
  })
})

describe('icon-name misses at render time (dev-only console.warn diagnosis)', () => {
  it('resolving a name with NO active icon set warns with the actual cause', async () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      // getIconSvg just returns undefined on a miss; warnIconMissDev is the diagnosis the icon
      // component fires alongside it (dev-only, once per name per process). Both run on the
      // lab's own handle — package code never resolves Payload itself.
      const { getIconSvg, warnIconMissDev } = await import('@pro-laico/payload-icons/cache')
      const svg = await getIconSvg(payload, 'never-registered')
      expect(svg).toBeFalsy()
      await warnIconMissDev(payload, 'never-registered')
      const warn = spy.mock.calls.map((c) => c.join(' ')).find((m) => m.includes('[payload-icons]'))
      expect(warn).toContain('did not resolve')
      expect(warn).toContain('no active icon set — activate one')
      record('icon miss: no active set', warn)
    } finally {
      spy.mockRestore()
    }
  })
})
