import { Suspense } from 'react'
import config from '@payload-config'
import { getPayload } from 'payload'
import { createDevPage } from '@pro-laico/payload-dev-tools/next'

import { devTests } from '@/dev/tests'

const DevPage = createDevPage({ payload: getPayload({ config }), tests: devTests })

export default function Page(props: Parameters<typeof DevPage>[0]) {
  return (
    <Suspense fallback={null}>
      <DevPage {...props} />
    </Suspense>
  )
}
