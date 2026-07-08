import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Cache Components (Next 16): 'use cache' + cacheTag are the primitives
  // @pro-laico/payload-revalidate targets — this flag is required.
  cacheComponents: true,
}

export default withPayload(nextConfig)
