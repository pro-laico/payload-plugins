import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resolveInitSettings } from '../../src/lib/initSettings'

const KEYS = [
  'MUX_TOKEN_ID',
  'MUX_TOKEN_SECRET',
  'MUX_WEBHOOK_SECRET',
  'MUX_WEBHOOK_SIGNING_SECRET',
  'MUX_SIGNING_KEY',
  'MUX_JWT_KEY_ID',
  'MUX_PRIVATE_KEY',
  'MUX_JWT_KEY',
] as const

describe('resolveInitSettings', () => {
  const saved: Record<string, string | undefined> = {}

  beforeEach(() => {
    for (const key of KEYS) {
      saved[key] = process.env[key]
      delete process.env[key]
    }
  })

  afterEach(() => {
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key]
      else process.env[key] = saved[key]
    }
  })

  it("reads the Mux SDK's own env names", () => {
    process.env.MUX_TOKEN_ID = 'id'
    process.env.MUX_TOKEN_SECRET = 'secret'
    process.env.MUX_WEBHOOK_SECRET = 'whsec'
    process.env.MUX_SIGNING_KEY = 'kid'
    process.env.MUX_PRIVATE_KEY = 'pem'
    expect(resolveInitSettings()).toEqual({
      tokenId: 'id',
      tokenSecret: 'secret',
      webhookSecret: 'whsec',
      jwtSigningKey: 'kid',
      jwtPrivateKey: 'pem',
    })
  })

  // The names the Oversight Studio plugin's README wires up. Reading them means a project
  // migrating from it keeps working without renaming anything in its host env.
  it('falls back to the Oversight Studio env names', () => {
    process.env.MUX_WEBHOOK_SIGNING_SECRET = 'whsec-oversight'
    process.env.MUX_JWT_KEY_ID = 'kid-oversight'
    process.env.MUX_JWT_KEY = 'pem-oversight'
    expect(resolveInitSettings()).toMatchObject({
      webhookSecret: 'whsec-oversight',
      jwtSigningKey: 'kid-oversight',
      jwtPrivateKey: 'pem-oversight',
    })
  })

  it('prefers the SDK name when both are set', () => {
    process.env.MUX_WEBHOOK_SECRET = 'whsec-sdk'
    process.env.MUX_WEBHOOK_SIGNING_SECRET = 'whsec-oversight'
    expect(resolveInitSettings().webhookSecret).toBe('whsec-sdk')
  })

  it('lets explicit initSettings beat every env var', () => {
    process.env.MUX_WEBHOOK_SECRET = 'whsec-sdk'
    process.env.MUX_WEBHOOK_SIGNING_SECRET = 'whsec-oversight'
    expect(resolveInitSettings({ webhookSecret: 'explicit' }).webhookSecret).toBe('explicit')
  })

  it('leaves unset fields undefined, so the SDK still applies its own env defaults', () => {
    expect(resolveInitSettings()).toEqual({
      tokenId: undefined,
      tokenSecret: undefined,
      webhookSecret: undefined,
      jwtSigningKey: undefined,
      jwtPrivateKey: undefined,
    })
  })
})
