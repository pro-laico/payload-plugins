import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { fontsPlugin } from '@pro-laico/payload-fonts'
import { buildConfig, getPayload, type Payload } from 'payload'

export interface BootedFonts {
  payload: Payload
  /** Close the DB and remove the temp upload dirs. */
  cleanup: () => Promise<void>
}

/**
 * Boot an isolated Payload instance for hook/collection tests: in-memory SQLite (schema pushed on
 * boot) and local-disk uploads pinned to a throwaway temp dir so the optimize hook can read the
 * originals it just wrote. Each test FILE is module-isolated under Vitest, so `getPayload` returns
 * a fresh instance per file. No external services; nothing touches the example's own DB.
 */
export async function bootFonts(): Promise<BootedFonts> {
  const dir = mkdtempSync(join(tmpdir(), 'fonts-hooks-'))
  const config = await buildConfig({
    secret: 'test-secret',
    db: sqliteAdapter({ client: { url: ':memory:' }, push: true }),
    collections: [{ slug: 'users', auth: true, fields: [] }],
    plugins: [
      fontsPlugin({
        collections: {
          fontOriginal: { upload: { staticDir: join(dir, 'original') } },
          fontOptimized: { upload: { staticDir: join(dir, 'optimized') } },
        },
      }),
    ],
    sharp: undefined,
    typescript: { autoGenerate: false },
  })
  const payload = await getPayload({ config })
  return {
    payload,
    cleanup: async () => {
      await (payload as unknown as { db?: { destroy?: () => Promise<void> } }).db?.destroy?.()
      rmSync(dir, { recursive: true, force: true })
    },
  }
}
