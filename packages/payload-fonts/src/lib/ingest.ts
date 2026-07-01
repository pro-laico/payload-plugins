import { readFile } from 'node:fs/promises'
import { basename, extname } from 'node:path'

import type { CollectionBeforeValidateHook, CollectionSlug, Payload } from 'payload'

/** A server-side font source: a local file path or an `http(s)` URL. */
export type FontSource = string

/** mime by font extension — the `fontOriginal` collection whitelists these (see FONT_MIME_TYPES). */
const MIME_BY_EXT: Record<string, string> = {
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
}
const mimeForFile = (name: string): string => MIME_BY_EXT[extname(name).toLowerCase()] ?? 'font/woff2'

/** Read a source's bytes: fetched for an `http(s)` URL, read from disk for a local path. */
async function readSourceBytes(source: FontSource): Promise<Buffer> {
  if (/^https?:\/\//i.test(source)) {
    const res = await fetch(source)
    if (!res.ok) throw new Error(`[payload-fonts] failed to fetch source '${source}': ${res.status} ${res.statusText}`)
    return Buffer.from(await res.arrayBuffer())
  }
  return readFile(source)
}

/**
 * The transient `source` value a `font` typeface is created with for server-side ingest —
 * the shape the seed engine builds from a doc's `_file` (`{ file, ...options }`), and what
 * `ingestFont` passes. A single file becomes one slot: a static `weights` row by default, or a
 * `variable` upright/italic slot when `variable` is set.
 */
export interface FontSourceValue {
  /** Local file path or `http(s)` URL of the font file to ingest. */
  file: FontSource
  /** Static-weight value for the created `weights` row. @default '400' (ignored when `variable`). */
  weight?: string
  /** Style of the file. Selects the `variable` slot (upright/italic) too. @default 'normal' */
  style?: 'normal' | 'italic'
  /** Treat the file as a variable font: fills the `variable` group instead of a `weights` row. */
  variable?: boolean
}

const isFontSourceValue = (v: unknown): v is FontSourceValue =>
  typeof v === 'object' && v !== null && typeof (v as { file?: unknown }).file === 'string'

export interface FontSourceHookOptions {
  /** Slug of the archival original upload collection. @default 'fontOriginal' */
  originalSlug?: string
}

/**
 * `beforeValidate` for the `font` typeface: turn a transient `source` (a local path / URL,
 * via {@link ingestFont} or a seed doc's `_file`) into a real upload. It reads the
 * file, creates a `fontOriginal` upload, points the right slot at it (`variable.upright` /
 * `variable.italic`, or a `weights` row), and strips `source` so it's never persisted. The
 * collection's existing `afterChange` optimize hook then subsets it to a served WOFF2 — so a
 * font can be created from a file with no browser uploader. The programmatic counterpart of
 * the admin upload slots; used by imports, migrations, and seeding.
 */
export const getFontSourceHook = (opts: FontSourceHookOptions = {}): CollectionBeforeValidateHook => {
  const originalSlug = (opts.originalSlug || 'fontOriginal') as CollectionSlug

  return async ({ data, req }) => {
    if (!data || !isFontSourceValue(data.source)) return data
    const src = data.source as FontSourceValue
    const bytes = await readSourceBytes(src.file)
    const name = basename(src.file.split(/[?#]/)[0] || src.file)
    // Shallow-cloned req: payload mutates `.file` on the req it's given for the upload; the
    // clone keeps that off the parent while sharing the transaction.
    const original = (await req.payload.create({
      collection: originalSlug,
      req: { ...req },
      overrideAccess: true,
      data: {} as never,
      file: { data: bytes, name, mimetype: mimeForFile(name), size: bytes.length },
    })) as { id: string | number }

    const style = src.style === 'italic' ? 'italic' : 'normal'
    if (src.variable) {
      const variable = (data.variable ?? {}) as Record<string, unknown>
      data.variable = { ...variable, [style === 'italic' ? 'italic' : 'upright']: original.id }
    } else {
      const weights = (Array.isArray(data.weights) ? data.weights : []) as unknown[]
      data.weights = [...weights, { weight: src.weight ?? '400', style, file: original.id }]
    }
    delete data.source
    return data
  }
}

export interface IngestFontOptions {
  /** Local file path or `http(s)` URL of the font file to ingest. */
  source: FontSource
  /** Typeface title (unique-ish identifier in the admin list). */
  title: string
  /** Generic family family the typeface fills (a configured `families` key). */
  family: string
  /** Static weight for the created row. @default '400' (ignored when `variable`). */
  weight?: string
  /** Style of the file. @default 'normal' */
  style?: 'normal' | 'italic'
  /** Treat the file as a variable font (fills the `variable` group). */
  variable?: boolean
  /** The `font` typeface collection slug. @default 'font' */
  collection?: string
}

/**
 * Create a `font` typeface doc from a local file or URL — the programmatic equivalent of
 * dropping a file into the admin upload slot. Hands `source` to the collection, whose
 * `beforeValidate` hook uploads it to `fontOriginal` and wires the slot; the `afterChange`
 * hook then subsets it into a served `fontOptimized` WOFF2.
 */
export async function ingestFont(payload: Payload, opts: IngestFontOptions): Promise<{ id: string | number }> {
  const collection = (opts.collection ?? 'font') as CollectionSlug
  const source: FontSourceValue = { file: opts.source, weight: opts.weight, style: opts.style, variable: opts.variable }
  const doc = await payload.create({
    collection,
    data: { title: opts.title, family: opts.family, source } as never,
    overrideAccess: true,
  })
  return doc as { id: string | number }
}
