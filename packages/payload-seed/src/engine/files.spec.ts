import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { resolveFilePath } from './files'

describe('resolveFilePath', () => {
  let root: string

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'seed-assets-'))
    await mkdir(join(root, 'media', 'portraits'), { recursive: true })
    await mkdir(join(root, 'images'), { recursive: true })
    await writeFile(join(root, 'media', 'hero.jpg'), 'x')
    await writeFile(join(root, 'media', 'portraits', 'jane.png'), 'x')
    await writeFile(join(root, 'images', 'logo.jpg'), 'x')
    await writeFile(join(root, 'flat.jpg'), 'x')
  })

  afterAll(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('resolves from the collection subdir (slug default)', async () => {
    expect(await resolveFilePath('hero.jpg', root, ['media', ''])).toBe(join(root, 'media', 'hero.jpg'))
  })

  it('resolves via an override subdir', async () => {
    expect(await resolveFilePath('logo.jpg', root, ['images', ''])).toBe(join(root, 'images', 'logo.jpg'))
  })

  it('resolves a nested subpath under the subdir', async () => {
    expect(await resolveFilePath('portraits/jane.png', root, ['media', ''])).toBe(join(root, 'media', 'portraits', 'jane.png'))
  })

  it('falls back to the assets root', async () => {
    expect(await resolveFilePath('flat.jpg', root, ['media', ''])).toBe(join(root, 'flat.jpg'))
  })

  it('tolerates an image extension mismatch', async () => {
    expect(await resolveFilePath('hero.png', root, ['media', ''])).toBe(join(root, 'media', 'hero.jpg'))
  })

  it('returns an absolute path as-is', async () => {
    const abs = join(root, 'media', 'hero.jpg')
    expect(await resolveFilePath(abs, root, ['media', ''])).toBe(abs)
  })

  it('returns null when nothing matches', async () => {
    expect(await resolveFilePath('missing.jpg', root, ['media', ''])).toBeNull()
  })
})
