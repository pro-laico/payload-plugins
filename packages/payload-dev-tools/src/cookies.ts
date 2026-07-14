import type { ChromeSlot } from './types'

export const STAGE_COOKIE = 'pdt-stage'

export const CHROME_COOKIES: Record<ChromeSlot, string> = { header: 'pdt-chrome-header', footer: 'pdt-chrome-footer' }
