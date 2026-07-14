import { Suspense } from 'react'
import config from '@payload-config'
import { getPayload } from 'payload'
import { createDevPage } from '@pro-laico/payload-dev-tools/next'

const DevPage = createDevPage({ payload: getPayload({ config }) })

export default function Page(props: Parameters<typeof DevPage>[0]) {
  return (
    <Suspense fallback={null}>
      <DevPage {...props} />
    </Suspense>
  )
}
