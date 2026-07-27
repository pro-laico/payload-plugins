import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parseArgs, resolveEnvFile } from '../../src/scripts/devEnv'

describe('parseArgs', () => {
  it('takes the env name first and everything after `--` as the command', () => {
    expect(parseArgs(['staging', '--', 'pnpm', 'dev'])).toEqual({ name: 'staging', file: undefined, command: ['pnpm', 'dev'] })
  })

  it('accepts the command without the `--` separator', () => {
    expect(parseArgs(['staging', 'pnpm', 'dev'])).toEqual({ name: 'staging', file: undefined, command: ['pnpm', 'dev'] })
  })

  it('reads --file in both spellings, before the name', () => {
    expect(parseArgs(['--file', '../.env.prod', 'prod', '--', 'node', 'x.js'])?.file).toBe('../.env.prod')
    expect(parseArgs(['--file=../.env.prod', 'prod', '--', 'node', 'x.js'])?.file).toBe('../.env.prod')
  })

  it("leaves the command's own flags alone", () => {
    expect(parseArgs(['staging', '--', 'pnpm', 'dev', '--file', 'x'])?.command).toEqual(['pnpm', 'dev', '--file', 'x'])
  })

  it('rejects a call with no name or no command', () => {
    for (const argv of [[], ['staging'], ['--file', 'x']]) expect(parseArgs(argv)).toBeNull()
  })
})

describe('resolveEnvFile', () => {
  let dir = ''
  let cwd = ''

  beforeEach(() => {
    cwd = process.cwd()
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdt-env-'))
    process.chdir(dir)
  })
  afterEach(() => {
    process.chdir(cwd)
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('prefers .env.<name>.local over .env.<name>', () => {
    fs.writeFileSync(path.join(dir, '.env.staging'), 'A=1')
    expect(resolveEnvFile('staging')).toBe(path.resolve(dir, '.env.staging'))

    fs.writeFileSync(path.join(dir, '.env.staging.local'), 'A=2')
    expect(resolveEnvFile('staging')).toBe(path.resolve(dir, '.env.staging.local'))
  })

  it('takes an explicit path over the search order', () => {
    fs.writeFileSync(path.join(dir, '.env.staging'), 'A=1')
    fs.writeFileSync(path.join(dir, 'custom.env'), 'A=3')
    expect(resolveEnvFile('staging', './custom.env')).toBe(path.resolve(dir, 'custom.env'))
  })

  it('returns null when nothing matches — better a loud failure than the wrong environment', () => {
    expect(resolveEnvFile('staging')).toBeNull()
    expect(resolveEnvFile('staging', './nope.env')).toBeNull()
  })
})
