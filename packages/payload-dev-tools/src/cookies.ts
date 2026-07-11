import type { ChromeSlot } from './types'

/** Session cookie holding the selected test version as `testKey:versionId`. Set by the toolbar's
 *  Tests view (or `GET /api/dev/stage` for scripted selection); read server-side by the test
 *  pages (`<devRoute>/tests/<key>`), which render the selected version — the toolbar is the
 *  controller, the page is the canvas. */
export const STAGE_COOKIE = 'pdt-stage'

/** Session cookies holding a chrome override as `testKey:versionId` — set by the toolbar, read by
 *  {@link resolveDevChrome} in the host layout, which swaps the REAL header/footer for the
 *  selected variant across the whole site (dev only). */
export const CHROME_COOKIES: Record<ChromeSlot, string> = { header: 'pdt-chrome-header', footer: 'pdt-chrome-footer' }
