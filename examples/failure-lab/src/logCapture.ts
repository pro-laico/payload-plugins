import type { CapturedLog } from './types'

export const logs: CapturedLog[] = []

export const captureDestination = {
  write(line: string): void {
    try {
      logs.push(JSON.parse(line) as CapturedLog) //TODO: replace `as` cast with proper typing
    } catch {}
  },
}

/** All captured warning messages (pino level 40), oldest first. */
export const warnMessages = (): string[] => logs.filter((l) => l.level === 40).map((l) => l.msg)

export function clearLogs(): void {
  logs.length = 0
}
