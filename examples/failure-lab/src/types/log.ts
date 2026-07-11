/** In-memory pino destination, wired into the config's `logger`, so tests can assert on (and
 *  re-print) exactly what the seed logged — warnings included. */
export interface CapturedLog {
  level: number
  msg: string
}
