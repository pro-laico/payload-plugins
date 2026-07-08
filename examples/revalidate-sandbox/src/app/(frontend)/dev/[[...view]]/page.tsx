import { createDevPage } from '@pro-laico/payload-dev-tools/next'
import { Suspense } from 'react'

// The dev pages (`/dev`, `/dev/revalidate`, …) read live Payload data — dynamic content,
// so under Cache Components they render inside a Suspense boundary.
const DevPage = createDevPage()

export default function Page(props: Parameters<typeof DevPage>[0]) {
  return (
    <Suspense fallback={null}>
      <DevPage {...props} />
    </Suspense>
  )
}
