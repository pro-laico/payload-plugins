import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Sharp ships a native binary — keep it out of the bundle (the transform endpoint uses it server-side).
  serverExternalPackages: ['sharp'],
}

export default withPayload(nextConfig)
