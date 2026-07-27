import fs from 'node:fs'
import dotenv from 'dotenv'
import path from 'node:path'
import { spawn } from 'node:child_process'

const USAGE = `payload-dev-env <name> [--file <path>] -- <command…>

  payload-dev-env staging -- pnpm dev        boot the dev server against .env.staging
  payload-dev-env prod --file ../.env.prod -- pnpm payload migrate:status

Looks for ./.env.<name>.local then ./.env.<name> (or PAYLOAD_DEV_ENV_FILE / --file), loads it, and
runs the command with those values. Env has to be picked before the process boots, so this is a
wrapper, not a toggle: switching environments means restarting.`

/** The env file for a name: an explicit path wins, otherwise `.env.<name>.local` before
 * `.env.<name>` — the same local-first order Next reads its own files in. */
export const resolveEnvFile = (name: string, explicit?: string): string | null => {
  const candidates = explicit ? [explicit] : [`./.env.${name}.local`, `./.env.${name}`]
  return candidates.map((c) => path.resolve(process.cwd(), c)).find((p) => fs.existsSync(p)) ?? null
}

const quote = (arg: string): string => (/[\s"]/.test(arg) ? `"${arg.replace(/"/g, '\\"')}"` : arg)

type Parsed = { name: string; file?: string; command: string[] }

export const parseArgs = (argv: string[]): Parsed | null => {
  const rest = [...argv]
  let name: string | undefined
  let file: string | undefined
  const command: string[] = []

  while (rest.length) {
    const arg = rest.shift()
    if (arg === undefined) break
    if (name && command.length) {
      command.push(arg)
      continue
    }
    if (arg === '--') {
      command.push(...rest.splice(0))
      continue
    }
    if (arg === '--file' || arg === '-f') {
      file = rest.shift()
      continue
    }
    if (arg.startsWith('--file=')) {
      file = arg.slice('--file='.length)
      continue
    }
    if (!name) name = arg
    else command.push(arg)
  }

  if (!name || !command.length) return null
  return { name, file, command }
}

/** Load an env file, then run the command with those values in front of the ambient environment.
 *
 * The child's own env loading doesn't undo this: `@next/env` only fills variables that aren't
 * already defined, so anything this injects survives `.env.local`. That's the whole trick — no
 * file shuffling, no `--env-file` (Node forbids it inside NODE_OPTIONS). */
export function runDevEnv(argv: string[]): void {
  const parsed = parseArgs(argv)
  if (!parsed) {
    console.error(USAGE)
    process.exit(1)
  }

  const { name, file: explicit, command } = parsed
  const file = resolveEnvFile(name, explicit ?? process.env.PAYLOAD_DEV_ENV_FILE)
  if (!file) {
    console.error(`[payload-dev-tools] No env file for '${name}' — looked for .env.${name}.local and .env.${name} in ${process.cwd()}.`)
    process.exit(1)
  }

  const values = dotenv.parse(fs.readFileSync(file))
  const relative = path.relative(process.cwd(), file)
  console.log(`[payload-dev-tools] ${name} → ${relative} (${Object.keys(values).length} vars) · ${command.join(' ')}`)

  const [bin, ...args] = command
  if (!bin) process.exit(1)

  const env = { ...process.env, ...values, PAYLOAD_DEV_ENV: name, PAYLOAD_DEV_ENV_FILE: relative }
  // Windows needs a shell to resolve `pnpm`/`npm` — they're `.cmd` shims, which spawn can't exec
  // directly. Under a shell the command goes as one pre-quoted string: passing an args array there
  // is what Node deprecated in DEP0190, since the shell would concatenate them unescaped anyway.
  const child =
    process.platform === 'win32'
      ? spawn(command.map(quote).join(' '), { stdio: 'inherit', shell: true, env })
      : spawn(bin, args, { stdio: 'inherit', env })

  child.on('error', (err) => {
    console.error(`[payload-dev-tools] Could not run '${bin}':`, err.message)
    process.exit(1)
  })
  child.on('exit', (code, signal) => process.exit(signal ? 1 : (code ?? 0)))
}
