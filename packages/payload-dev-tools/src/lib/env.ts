import type { Payload } from 'payload'

import type { DatabaseStatus, EnvSnapshot, EnvVarStatus } from '../types'

type EnvVarSpec = { name: string; owner: string; required: boolean }

// Whichever one the app's adapter reads — the first one set is the connection.
const DB_VARS = ['DATABASE_URI', 'DATABASE_URL', 'MONGODB_URI', 'MONGO_URL', 'POSTGRES_URL']
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0', 'host.docker.internal', 'mongo', 'postgres', 'db'])

const isSet = (name: string): boolean => (process.env[name] ?? '') !== ''

/** Host only — never the URI. A connection string carries the password, and this ends up in a
 * snapshot the toolbar fetches. `new URL().hostname` drops the credentials for us. */
const hostOf = (uri: string): string | null => {
  if (uri.startsWith('file:') || uri.startsWith('sqlite:')) return 'file'
  try {
    return new URL(uri).hostname || null
  } catch {
    return null
  }
}

const databaseStatus = (): DatabaseStatus | null => {
  const variable = DB_VARS.find(isSet)
  if (!variable) return null
  const host = hostOf(process.env[variable] ?? '')
  return { variable, host, local: host === 'file' || (host !== null && LOCAL_HOSTS.has(host)) }
}

/** What the app booted with: the env file the `payload-dev-env` CLI picked (if it was used), a
 * present/missing checklist for the variables the installed plugins read, and the warnings worth
 * interrupting someone over. Values never leave the process — only `set` booleans and the DB host. */
export function buildEnvSnapshot(payload: Payload): EnvSnapshot {
  const custom = payload.config.custom ?? {}
  const specs: EnvVarSpec[] = [
    { name: 'PAYLOAD_SECRET', owner: 'payload', required: true },
    { name: 'NEXT_PUBLIC_SERVER_URL', owner: 'payload', required: false },
    ...(custom.payloadSeed ? [{ name: 'ENABLE_SEED', owner: 'payload-seed', required: false }] : []),
    ...(custom.payloadMux
      ? [
          { name: 'MUX_TOKEN_ID', owner: 'payload-mux', required: true },
          { name: 'MUX_TOKEN_SECRET', owner: 'payload-mux', required: true },
          { name: 'MUX_WEBHOOK_SECRET', owner: 'payload-mux', required: false },
          { name: 'MUX_SIGNING_KEY', owner: 'payload-mux', required: false },
          { name: 'MUX_PRIVATE_KEY', owner: 'payload-mux', required: false },
        ]
      : []),
    ...(custom.payloadIcons ? [{ name: 'ICON_USAGE_TRACKING', owner: 'payload-icons', required: false }] : []),
    ...(custom.payloadImages ? [{ name: 'IMAGES_SHARP_CONCURRENCY', owner: 'payload-images', required: false }] : []),
    ...(custom.payloadFonts ? [{ name: 'FONT_DOWNLOAD_URL', owner: 'payload-fonts', required: false }] : []),
  ]

  const database = databaseStatus()
  const nodeEnv = process.env.NODE_ENV ?? 'development'
  const vars: EnvVarStatus[] = [
    { name: database?.variable ?? DB_VARS[0] ?? 'DATABASE_URI', owner: 'payload', required: true, set: !!database },
    ...specs.map((spec) => ({ ...spec, set: isSet(spec.name) })),
  ]

  const warnings = vars.filter((v) => v.required && !v.set).map((v) => `${v.name} is not set — ${v.owner} needs it.`)
  if (nodeEnv === 'development' && database && !database.local) {
    warnings.push(`${database.variable} points at ${database.host ?? 'a remote host'} — this dev boot is writing to a non-local database.`)
  }
  if (nodeEnv === 'production') warnings.push('The dev tools are running with NODE_ENV=production.')

  return {
    nodeEnv,
    nodeVersion: process.version,
    name: process.env.PAYLOAD_DEV_ENV ?? null,
    file: process.env.PAYLOAD_DEV_ENV_FILE ?? null,
    database,
    vars,
    warnings,
  }
}
