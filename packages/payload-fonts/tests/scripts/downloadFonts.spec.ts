import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { runDownloadFonts, writeFontsFromManifest } from '../../src/scripts/downloadFonts'
import type { ExportFontsResponse } from '../../src/types'

// A definition.ts as a previous SUCCESSFUL run would have written it — one localFont() call per
// family, importing files under public/fonts. The bug being guarded: on a later FAILED run, this
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
    vi.unstubAllEnvs()
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

  // A build with no fonts is only tolerable because failing would be worse: no server yet means no
  // fonts selected, which would fail the build, which means you never get a server. So it stays
  // exit-0 — but in production it says so, instead of the dev-shaped info line.
  it('says so loudly when a production build ends up with no fonts, and still exits 0', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    process.env.PAYLOAD_SECRET = 'secret'
    const refused = Object.assign(new TypeError('fetch failed'), {
      cause: Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:1'), { code: 'ECONNREFUSED' }),
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(refused)),
    )

    await runDownloadFonts({ ...baseOpts(), siteUrl: 'http://localhost:1' })

    expect(hasFontDeclarations(definitionFile)).toBe(false)
    const warned = vi
      .mocked(console.warn)
      .mock.calls.map((c) => String(c[0]))
      .join('\n')
    expect(warned).toContain('this build has NO fonts')
    expect(warned).toContain('fonts:download') // point them at the transport that doesn't need a server
  })

  it('treats connection-refused as the calm predev state — empties the definition without the loud failure', async () => {
    process.env.PAYLOAD_SECRET = 'secret'
    // Node's fetch shape for a down server: TypeError('fetch failed') with the code on `cause`.
    const refused = Object.assign(new TypeError('fetch failed'), {
      cause: Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:1'), { code: 'ECONNREFUSED' }),
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(refused)),
    )

    await runDownloadFonts({ ...baseOpts(), siteUrl: 'http://localhost:1' })

    expect(hasFontDeclarations(definitionFile)).toBe(false)
    expect(vi.mocked(console.warn)).not.toHaveBeenCalled()
    expect(vi.mocked(console.log).mock.calls.some((c) => String(c[0]).includes('no running Payload'))).toBe(true)
  })

  it('fails clearly when FONT_DOWNLOAD_URL is not an http(s) URL', async () => {
    process.env.PAYLOAD_SECRET = 'secret'

    await runDownloadFonts({ ...baseOpts(), siteUrl: 'localhost:3000' })

    expect(hasFontDeclarations(definitionFile)).toBe(false)
    expect(vi.mocked(console.warn).mock.calls.some((c) => String(c[0]).includes('not a valid http(s) URL'))).toBe(true)
  })

  it('names the per-family cause from the export diagnostics when nothing comes back', async () => {
    process.env.PAYLOAD_SECRET = 'secret'
    const manifest = {
      fonts: {},
      diagnostics: {
        sans: { selected: true, typeface: 'Inter', optimizedFiles: 0, readFailures: 0 },
        serif: { selected: false, optimizedFiles: 0, readFailures: 0 },
        mono: { selected: true, typeface: 'JetBrains Mono', optimizedFiles: 2, readFailures: 2 },
      },
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(manifest) } as Response)),
    )

    await runDownloadFonts({ ...baseOpts(), siteUrl: 'http://localhost:1' })

    const logged = vi
      .mocked(console.log)
      .mock.calls.map((c) => String(c[0]))
      .join('\n')
    expect(logged).toContain("sans: 'Inter' selected but has 0 optimized files")
    expect(logged).toContain('serif: no typeface selected')
    expect(logged).toContain("mono: 'JetBrains Mono' selected but 2/2 optimized files could not be read")
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

  it('generates a font<Key> export + --font-set<Key> var for a custom family key', () => {
    process.env.PAYLOAD_SECRET = 'secret'
    // The export endpoint keys the response by whatever families the plugin was configured with; the
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

  // Options were read out of process.env BEFORE dotenv loaded the file, so a PAYLOAD_FONTS_* var
  // in .env.local was ignored and silently fell back to its default — while FONT_DOWNLOAD_URL,
  // read later, picked it up. Both paths resolve options through the same place now, so this also
  // covers `payload fonts:download`.
  it('honours PAYLOAD_FONTS_* from the env file, not just the shell', async () => {
    const envFile = path.join(dir, '.env.local')
    const outFromEnvFile = path.join(dir, 'from-env-file')
    fs.writeFileSync(envFile, `PAYLOAD_FONTS_OUTPUT_DIR=${outFromEnvFile.replace(/\\/g, '/')}\n`)
    delete process.env.PAYLOAD_FONTS_OUTPUT_DIR

    const manifest: ExportFontsResponse = {
      fonts: {
        sans: [
          {
            filename: 'inter.woff2',
            extension: 'woff2',
            mimeType: 'font/woff2',
            data: Buffer.from('x').toString('base64'),
            weight: '400',
            style: 'normal',
          },
        ],
      },
      diagnostics: {},
    }

    writeFontsFromManifest(manifest, { definitionFile, envFile })

    expect(fs.existsSync(path.join(outFromEnvFile, 'sans-400.woff2'))).toBe(true)
  })

  // The seam `payload fonts:download` uses: it reads the manifest from the database through the
  // Local API, then hands it to the same writer the HTTP path uses.
  describe('writeFontsFromManifest — the transport-free half', () => {
    const manifest: ExportFontsResponse = {
      fonts: {
        sans: [
          {
            filename: 'inter.woff2',
            extension: 'woff2',
            mimeType: 'font/woff2',
            data: Buffer.from('x').toString('base64'),
            weight: '400',
            style: 'normal',
          },
        ],
      },
      diagnostics: {},
    }

    it('writes the files and the definition with no server, no URL, and no secret', () => {
      delete process.env.PAYLOAD_SECRET
      delete process.env.FONT_DOWNLOAD_URL
      vi.stubGlobal(
        'fetch',
        vi.fn(() => Promise.reject(new Error('the local path must not touch the network'))),
      )

      writeFontsFromManifest(manifest, baseOpts())

      const out = fs.readFileSync(definitionFile, 'utf8')
      expect(out).toContain("import localFont from 'next/font/local'")
      expect(out).toContain('const fontSans = localFont(')
      expect(fs.existsSync(path.join(fontsOutputDir, 'sans-400.woff2'))).toBe(true)
    })

    it('empties a stale definition when the database has no active fonts', () => {
      expect(hasFontDeclarations(definitionFile)).toBe(true) // a previous run's output

      writeFontsFromManifest({ fonts: {}, diagnostics: {} }, baseOpts())

      expect(hasFontDeclarations(definitionFile)).toBe(false)
      expect(fs.readFileSync(definitionFile, 'utf8')).toContain('No fonts available')
    })
  })
})
