// The dev-pages entry — `createDevPage` powers the one drop-in catch-all route
// (`app/(frontend)/dev/[[...view]]/page.tsx`). Server-side only: it boots Payload.
export { createDevPage } from './next/createDevPage'
export type { CreateDevPageOptions } from './next/createDevPage'
export { defineTest } from './harness'
export type { Test, TestKind, TestVersion } from './harness'
