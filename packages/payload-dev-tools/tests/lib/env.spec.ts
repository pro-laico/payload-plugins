import type { Payload } from 'payload'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildEnvSnapshot } from '../../src/lib/env'

const fakePayload = (custom: Record<string, unknown> = {}): Payload => ({ config: { custom } }) as unknown as Payload

const varNames = (payload: Payload): string[] => buildEnvSnapshot(payload).vars.map((v) => v.name)

afterEach(() => vi.unstubAllEnvs())

describe('buildEnvSnapshot', () => {
  it('reports presence, never values', () => {
    vi.stubEnv('PAYLOAD_SECRET', 'super-secret')
    const secret = buildEnvSnapshot(fakePayload()).vars.find((v) => v.name === 'PAYLOAD_SECRET')
    expect(secret).toEqual({ name: 'PAYLOAD_SECRET', owner: 'payload', required: true, set: true })
    expect(JSON.stringify(buildEnvSnapshot(fakePayload()))).not.toContain('super-secret')
  })

  it('treats an empty string as unset', () => {
    vi.stubEnv('PAYLOAD_SECRET', '')
    expect(buildEnvSnapshot(fakePayload()).vars.find((v) => v.name === 'PAYLOAD_SECRET')?.set).toBe(false)
  })

  it('asks only for the variables the installed plugins actually read', () => {
    expect(varNames(fakePayload())).not.toContain('MUX_TOKEN_ID')
    expect(varNames(fakePayload({ payloadMux: {} }))).toContain('MUX_TOKEN_ID')
    expect(varNames(fakePayload({ payloadSeed: {} }))).toContain('ENABLE_SEED')
  })

  it('picks up whichever database variable the adapter uses, and keeps the credentials out of the host', () => {
    vi.stubEnv('MONGODB_URI', 'mongodb+srv://admin:hunter2@cluster0.abc.mongodb.net/site')
    const { database } = buildEnvSnapshot(fakePayload())
    expect(database).toEqual({ variable: 'MONGODB_URI', host: 'cluster0.abc.mongodb.net', local: false })
  })

  it('counts a local host and a sqlite file as local', () => {
    vi.stubEnv('DATABASE_URI', 'mongodb://localhost:27017/site')
    expect(buildEnvSnapshot(fakePayload()).database).toMatchObject({ host: 'localhost', local: true })

    vi.stubEnv('DATABASE_URI', 'file:./service-co.db')
    expect(buildEnvSnapshot(fakePayload()).database).toMatchObject({ host: 'file', local: true })
  })

  it('warns when a development boot points at a remote database', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('DATABASE_URI', 'postgres://user:pw@db.prod.example.com:5432/site')
    expect(buildEnvSnapshot(fakePayload()).warnings).toContainEqual(expect.stringContaining('db.prod.example.com'))
  })

  it('warns about every missing required variable, and stays quiet about optional ones', () => {
    vi.stubEnv('PAYLOAD_SECRET', '')
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', '')
    const { warnings } = buildEnvSnapshot(fakePayload({ payloadMux: {} }))
    expect(warnings).toContainEqual(expect.stringContaining('PAYLOAD_SECRET'))
    expect(warnings).toContainEqual(expect.stringContaining('MUX_TOKEN_ID'))
    expect(warnings.join()).not.toContain('NEXT_PUBLIC_SERVER_URL')
  })

  it('reports the env the payload-dev-env CLI booted it with', () => {
    expect(buildEnvSnapshot(fakePayload())).toMatchObject({ name: null, file: null })

    vi.stubEnv('PAYLOAD_DEV_ENV', 'staging')
    vi.stubEnv('PAYLOAD_DEV_ENV_FILE', '.env.staging')
    expect(buildEnvSnapshot(fakePayload())).toMatchObject({ name: 'staging', file: '.env.staging' })
  })
})
