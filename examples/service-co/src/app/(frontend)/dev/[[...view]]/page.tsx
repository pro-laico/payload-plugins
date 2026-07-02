import { createDevPage } from '@pro-laico/payload-dev-tools/next'
import { devTests } from '@/dev/tests'

// The /dev pages — the whole lab area from one file: /dev (overview + seed), /dev/icons (grid +
// active-set switcher), /dev/fonts (brand-font specimens), /dev/images, /dev/mux, and
// /dev/tests/<test> (one page per test; the shown version is toggled from the dev toolbar, which
// is also how you navigate between all of these). Dev-only; 404s in production. A static route
// (e.g. app/(frontend)/dev/blocks/page.tsx) would take precedence over this catch-all, so
// app-specific labs can live alongside it.
export const dynamic = 'force-dynamic'

export default createDevPage({ tests: devTests })
