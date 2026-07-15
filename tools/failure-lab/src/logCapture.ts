import type { CapturedLog } from './types'

export const logs: CapturedLog[] = []

/** Narrows one parsed pino line (external data) to the fields the lab asserts on. */
function toCapturedLog(value: unknown): CapturedLog | null {
  if (typeof value !== 'object' || value === null) return null
  if (!('level' in value) || typeof value.level !== 'number') return null
  if (!('msg' in value) || typeof value.msg !== 'string') return null
  return { level: value.level, msg: value.msg }
}

export const captureDestination = {
  write(line: string): void {
    try {
      const log = toCapturedLog(JSON.parse(line))
      if (log) logs.push(log)
    } catch {}
  },
}

/** All captured warning messages (pino level 40), oldest first. */
export const warnMessages = (): string[] => logs.filter((l) => l.level === 40).map((l) => l.msg)

export function clearLogs(): void {
  logs.length = 0
}
