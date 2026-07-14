'use client'

import { Pill, RowLabel, useRowLabel } from '@payloadcms/ui'

import type { IconRowData } from '../../types'
import { toTitleCase } from '../../lib/titleCase'

const IconRowLabel = () => {
  const { data, path, rowNumber } = useRowLabel<IconRowData>()

  return (
    <RowLabel
      path={path}
      rowNumber={rowNumber}
      label={
        <>
          <span>{rowNumber}</span>
          <Pill pillStyle="white" size="small">
            {toTitleCase(data?.name) || 'Add Name'}
          </Pill>
        </>
      }
    />
  )
}

IconRowLabel.displayName = 'IconRowLabel'

export default IconRowLabel
