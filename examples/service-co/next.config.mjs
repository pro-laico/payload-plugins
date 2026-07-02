import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // `subset-font` (harfbuzz) and `fontkit` load wasm/native assets at runtime by a path relative
  // to their own module. Bundling them rewrites that path to a virtual one that doesn't exist on
  // disk (→ "hb-subset.wasm ENOENT"), so the subset step silently fails. `sharp` is native too.
  // Required by any app that runs @pro-laico/payload-fonts / @pro-laico/payload-images.
  serverExternalPackages: ['subset-font', 'harfbuzzjs', 'fontkit', 'sharp'],
}

export default withPayload(nextConfig)
