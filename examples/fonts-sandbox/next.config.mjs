import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Live reads (the seeded fonts, <PreviewFonts>) render as dynamic holes inside <Suspense>, while
  // the shell prerenders — the real-world pattern. No `export const dynamic = 'force-dynamic'`.
  cacheComponents: true,
  // `subset-font` (harfbuzz) and `fontkit` load wasm/native assets at runtime by a path relative
  // to their own module. Bundling them rewrites that path to a virtual one that doesn't exist on
  // disk (→ "hb-subset.wasm ENOENT"), so the subset step silently fails. Keep them external so
  // they resolve straight from node_modules. Required by any app that runs @pro-laico/payload-fonts.
  serverExternalPackages: ['subset-font', 'harfbuzzjs', 'fontkit'],
}

export default withPayload(nextConfig)
