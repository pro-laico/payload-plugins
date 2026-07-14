'use client'

import { UploadField } from '@payloadcms/ui'
import type { UploadFieldClientProps } from 'payload'

import './FontOriginalUpload.scss'

export const FontOriginalUpload = (props: UploadFieldClientProps) => (
  <div className="font-original-upload">
    <UploadField {...props} />
  </div>
)

export default FontOriginalUpload
