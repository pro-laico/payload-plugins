import type { MetadataRoute } from 'next'
import { appDescription, appName } from '@/lib/shared'

/** `favicon.ico`, `icon.svg` and `apple-icon.png` are picked up from `src/app` by file convention;
 * this covers what a manifest has to state itself — the installed name and the launch colours. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: appName,
    short_name: appName,
    description: appDescription,
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0a0a',
    theme_color: '#0a0a0a',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // Android crops any icon to its own shape; the maskable copy keeps padding for that.
      { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
