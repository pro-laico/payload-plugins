import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createMDX } from 'fumadocs-mdx/next'

const withMDX = createMDX()
const monorepoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // Pin the workspace root (monorepo root) so Next doesn't mis-infer it from stray lockfiles.
  turbopack: {
    root: monorepoRoot,
  },
  async rewrites() {
    return {
      // beforeFiles so a markdown-negotiated request preempts the HTML page route.
      beforeFiles: [
        // Content negotiation: agents that prefer markdown (Claude Code & others send
        // `Accept: text/markdown`) get the clean version at the SAME url — no .md suffix.
        {
          source: '/docs/:path*',
          has: [{ type: 'header', key: 'accept', value: '(.*)text/markdown(.*)' }],
          destination: '/llms.mdx/docs/:path*',
        },
        // Explicit fallback: appending `.md` to any docs URL also serves the clean markdown.
        { source: '/docs/:path*.md', destination: '/llms.mdx/docs/:path*' },
      ],
    }
  },
  // Tell caches the docs HTML varies by Accept, so a markdown-preferring agent isn't served cached HTML.
  async headers() {
    return [{ source: '/docs/:path*', headers: [{ key: 'Vary', value: 'Accept' }] }]
  },
}

export default withMDX(config)
