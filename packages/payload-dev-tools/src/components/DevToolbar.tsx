import { Suspense } from 'react'

import { PDT_CSS } from './styles'
import { devEnabled } from '../lib/devEnabled'
import { toTestMeta } from '../harness'
import type { DevToolbarProps } from '../types'
import { DevToolbarClient } from './DevToolbarClient'

export function DevToolbar({ tests = [], links = [], enabled }: DevToolbarProps) {
  if (!devEnabled(enabled)) return null

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PDT_CSS }} />
      <Suspense fallback={null}>
        <DevToolbarClient tests={toTestMeta(tests)} links={links} />
      </Suspense>
    </>
  )
}
