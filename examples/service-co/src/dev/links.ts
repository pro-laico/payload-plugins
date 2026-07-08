import type { DevLink } from '@pro-laico/payload-dev-tools/toolbar'

// The dev-toolbar Links view, shared by the frontend and admin layouts. Kept separate from
// tests.tsx so the admin layout doesn't pull the test variants (frontend components) into its tree.
export const devLinks: DevLink[] = [
  { href: '/', title: 'Home' },
  { href: '/services', title: 'Services' },
  { href: '/work', title: 'Work' },
  { href: '/about', title: 'About' },
  { href: '/contact', title: 'Contact' },
  { href: '/dev/revalidate', title: 'Revalidate map' },
]
