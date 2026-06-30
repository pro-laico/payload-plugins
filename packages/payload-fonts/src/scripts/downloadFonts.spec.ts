import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { runDownloadFonts } from './downloadFonts'

// A definition.ts as a previous SUCCESSFUL run would have written it — one localFont() call per
// role, importing files under public/fonts. The bug being guarded: on a later FAILED run, this
// stale file (which imports font files a fresh checkout doesn't have) must be reset to empty.
const POPULATED_DEFINITION = `import localFont from 'next/font/local'
const fontSans = localFont({ src: [{ path: '../../public/fonts/sans-400.woff2', weight: '400', style: 'normal' }], variable: '--font-setSans' })
const fonts = { fontSans }
export default fonts
`

const hasFontDeclarations = (file: string): boolean => fs.readFileSync(file, 'utf8').includes('localFont({')

describe('runDownloadFonts — empties definition.ts on any error', () => {
  let dir: string
  let definitionFile: string
  let fontsOutputDir: string
  const savedSecret = process.env.PAYLOAD_SECRET
  const savedUrl = process.env.FONT_DOWNLOAD_URL

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pf-fonts-cli-'))
    definitionFile = path.join(dir, 'definition.ts')
    fontsOutputDir = path.join(dir, 'public', 'fonts')
    // Seed a populated definition (and a font file it references), as a prior run would leave.
    fs.mkdirSync(fontsOutputDir, { recursive: true })
    fs.writeFileSync(definitionFile, POPULATED_DEFINITION)
    fs.writeFileSync(path.join(fontsOutputDir, 'sans-400.woff2'), Buffer.from('x'))
    // Quiet the script's console output during the test.
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    fs.rmSync(dir, { recursive: true, force: true })
    if (savedSecret === undefined) delete process.env.PAYLOAD_SECRET
    else process.env.PAYLOAD_SECRET = savedSecret
    if (savedUrl === undefined) delete process.env.FONT_DOWNLOAD_URL
    else process.env.FONT_DOWNLOAD_URL = savedUrl
  })

  // Common overrides: point at the temp definition + a non-existent env file (so dotenv is a no-op).
  const baseOpts = () => ({ definitionFile, fontsOutputDir, envFile: path.join(dir, '.env.absent') })

  it('empties the definition when required env vars are missing', async () => {
    delete process.env.PAYLOAD_SECRET
    delete process.env.FONT_DOWNLOAD_URL
    expect(hasFontDeclarations(definitionFile)).toBe(true)

    await runDownloadFonts(baseOpts())

    expect(hasFontDeclarations(definitionFile)).toBe(false)
    expect(fs.readFileSync(definitionFile, 'utf8')).toContain('No fonts available')
  })

  it('empties the definition when the export endpoint fetch throws', async () => {
    process.env.PAYLOAD_SECRET = 'secret'
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('connection refused'))),
    )

    await runDownloadFonts({ ...baseOpts(), siteUrl: 'http://localhost:1' })

    expect(hasFontDeclarations(definitionFile)).toBe(false)
  })

  it('empties the definition when the export endpoint returns a non-OK status', async () => {
    process.env.PAYLOAD_SECRET = 'secret'
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: false, status: 503, statusText: 'Service Unavailable' } as Response)),
    )

    await runDownloadFonts({ ...baseOpts(), siteUrl: 'http://localhost:1' })

    expect(hasFontDeclarations(definitionFile)).toBe(false)
  })

  it('writes the real definition on success (control — not emptied)', async () => {
    process.env.PAYLOAD_SECRET = 'secret'
    const manifest = {
      fonts: {
        sans: [
          {
            filename: 'inter.woff2',
            extension: 'woff2',
            mimeType: 'font/woff2',
            data: Buffer.from('abc').toString('base64'),
            weight: '400',
            style: 'normal',
          },
        ],
      },
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(manifest) } as Response)),
    )

    await runDownloadFonts({ ...baseOpts(), siteUrl: 'http://localhost:1' })

    expect(hasFontDeclarations(definitionFile)).toBe(true)
    expect(fs.readFileSync(definitionFile, 'utf8')).toContain('--font-setSans')
  })

  it('generates a font<Key> export + --font-set<Key> var for a custom role key', () => {
    process.env.PAYLOAD_SECRET = 'secret'
    // The export endpoint keys the response by whatever roles the plugin was configured with; the
    // CLI must discover them from the response, not a hardcoded sans/serif/mono/display list.
    const manifest = {
      fonts: {
        brand: [
          {
            filename: 'brand.woff2',
            extension: 'woff2',
            mimeType: 'font/woff2',
            data: Buffer.from('abc').toString('base64'),
            weight: '700',
            style: 'normal',
          },
        ],
      },
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(manifest) } as Response)),
    )

    return runDownloadFonts({ ...baseOpts(), siteUrl: 'http://localhost:1' }).then(() => {
      const out = fs.readFileSync(definitionFile, 'utf8')
      expect(out).toContain('const fontBrand = localFont(')
      expect(out).toContain("variable: '--font-setBrand'")
      expect(out).toContain('const fonts = { fontBrand }')
      expect(fs.existsSync(path.join(fontsOutputDir, 'brand-700.woff2'))).toBe(true)
    })
  })
})
