/** One environment variable the running app cares about — never its value, only whether it's there.
 * `owner` is the plugin (or `payload`) that reads it; `required` is scoped to what's installed. */
export type EnvVarStatus = { name: string; owner: string; required: boolean; set: boolean }

/** The database connection as far as the snapshot will admit to it: which variable carries it and
 * which host it points at, with credentials and path dropped. */
export type DatabaseStatus = { variable: string; host: string | null; local: boolean }

/** What the app booted with. `name`/`file` are stamped by the `payload-dev-env` CLI; a plain
 * `next dev` leaves them null. */
export type EnvSnapshot = {
  nodeEnv: string
  nodeVersion: string
  name: string | null
  file: string | null
  database: DatabaseStatus | null
  vars: EnvVarStatus[]
  warnings: string[]
}
