'use client'

import { Pill, RowLabel, useRowLabel } from '@payloadcms/ui'

import { toTitleCase } from '../../lib/titleCase'
import type { IconRowData } from '../../types'

/** RowLabel for each `iconsArray` entry — shows the row number and the icon's
 *  Title-cased name (or an "Add Name" prompt for an empty row). */
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
