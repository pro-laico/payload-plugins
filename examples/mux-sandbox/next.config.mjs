import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Live reads (seed status, the seeded/uploaded videos) render as dynamic holes inside <Suspense>,
  // while the shell prerenders — the real-world pattern. No `export const dynamic = 'force-dynamic'`.
  cacheComponents: true,
}

export default withPayload(nextConfig)
