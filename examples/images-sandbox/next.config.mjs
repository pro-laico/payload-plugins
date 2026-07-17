import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Live reads (seeded images/pages, the responsive demo) render as dynamic holes inside <Suspense>,
  // while the shell prerenders — the real-world pattern. No `export const dynamic = 'force-dynamic'`.
  cacheComponents: true,
  // Sharp ships a native binary — keep it out of the bundle (the transform endpoint uses it server-side).
  serverExternalPackages: ['sharp'],
}

export default withPayload(nextConfig)
