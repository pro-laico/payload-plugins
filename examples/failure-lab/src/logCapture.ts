/** In-memory pino destination, wired into the config's `logger`, so tests can assert on (and
 *  re-print) exactly what the seed logged — warnings included. */
export interface CapturedLog {
  level: number
  msg: string
}

export const logs: CapturedLog[] = []

export const captureDestination = {
  write(line: string): void {
    try {
      logs.push(JSON.parse(line) as CapturedLog)
    } catch {
      // Non-JSON lines aren't ours to capture.
    }
  },
}

/** All captured warning messages (pino level 40), oldest first. */
export const warnMessages = (): string[] => logs.filter((l) => l.level === 40).map((l) => l.msg)

export function clearLogs(): void {
  logs.length = 0
}
