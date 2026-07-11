import { randomUUID } from 'node:crypto'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { buildConfig, getPayload, type CollectionConfig, type Config, type GlobalConfig, type Plugin } from 'payload'
import { captureDestination } from './logCapture'
import type { LabBoot } from './types'

export type { LabBoot } from './types'

/** Boot an isolated Payload instance for one plugin's failure scenarios: a UNIQUE throwaway SQLite
 *  file (`:memory:` is shared per-process by libsql — a second boot's schema push would wipe the
 *  first instance's rows), a `users` auth collection, and ALL logging routed through the in-memory
 *  capture so tests can assert on the exact messages. Each spec FILE is module-isolated under
 *  Vitest, so the capture buffer and any plugin globals are fresh per file. */
export async function bootLab(opts: {
  plugins: Plugin[]
  collections?: CollectionConfig[]
  globals?: GlobalConfig[]
  sharp?: Config['sharp']
}): Promise<LabBoot> {
  const id = randomUUID()
  const dbPath = join(tmpdir(), `failure-lab-${id}.db`)
  const config = await buildConfig({
    secret: 'test-secret',
    db: sqliteAdapter({ client: { url: `file:${dbPath}` }, push: true }),
    logger: { options: { level: 'info' }, destination: captureDestination },
    telemetry: false,
    collections: [{ slug: 'users', auth: true, fields: [] }, ...(opts.collections ?? [])],
    ...(opts.globals ? { globals: opts.globals } : {}),
    plugins: opts.plugins,
    ...(opts.sharp ? { sharp: opts.sharp } : {}),
    typescript: { autoGenerate: false },
  })
  // getPayload caches instances per `key` (default 'default') — without a unique key, a SECOND
  // boot in the same process returns the FIRST instance (its onInit never runs, and cleaning it
  // up destroys the shared adapter under the other tests' feet).
  const payload = await getPayload({ config, key: `lab-${id}` })
  return {
    payload,
    cleanup: async () => {
      await (payload as unknown as { db?: { destroy?: () => Promise<void> } }).db?.destroy?.()
      // Windows can hold the handle briefly after destroy (EBUSY) — the OS temp dir cleans up.
      await rm(dbPath, { force: true }).catch(() => {})
    },
  }
}

/** Drive a boot-time THROW scenario: build a minimal config with the given plugins and return the
 *  rejection (plugins apply inside buildConfig, so a config-time guard throws here). */
export async function expectBootError(plugins: Plugin[], collections: CollectionConfig[] = []): Promise<Error> {
  try {
    await buildConfig({
      secret: 'test-secret',
      db: sqliteAdapter({ client: { url: ':memory:' }, push: true }),
      telemetry: false,
      collections: [{ slug: 'users', auth: true, fields: [] }, ...collections],
      plugins,
      typescript: { autoGenerate: false },
    })
  } catch (e) {
    return e as Error
  }
  throw new Error('expected buildConfig to fail, but it succeeded')
}
