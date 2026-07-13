import { Icon } from '@/components/PayloadIcon'

// Demonstrates Icon Usage Detection. The IconSet "Requested icons" panel scans this source live in
// dev, so these literal `<Icon name>` usages show up there: `arrow-right` is in the seeded set
// (present), `rocket` isn't (flagged as missing, with this file:line). Not rendered anywhere — it
// exists purely to give the scanner something to find.
export const IconUsageDemo = async () => (
  <>
    <Icon name="arrow-right" />
    <Icon name="rocket" />
  </>
)
