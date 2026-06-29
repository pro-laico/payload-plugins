'use client'

import MuxPlayer from '@mux/mux-player-react'
import MuxUploader from '@mux/mux-uploader-react'
import { useConfig, useForm, useFormFields } from '@payloadcms/ui'
import { useCallback, useEffect, useState } from 'react'
import './mux-uploader.css'

/** Strip the extension from a filename (`clip.final.mp4` → `clip.final`). */
const stripExtension = (name: string): string => name.replace(/\.[^./\\]+$/, '')

/**
 * The admin Field for the `muxUploader` UI field. Three states: an uploader before a video
 * exists, a "processing" notice while Mux encodes, and the Mux player once a playback URL is
 * available. Uploads go directly to Mux via a direct-upload URL the plugin's endpoint mints.
 */
export const MuxUploaderField = () => {
  const { config } = useConfig()
  const apiUrl = config.routes.api

  const [uploadId, setUploadId] = useState('')
  const { assetId, setAssetId, title, setTitle, setFile, playbackUrl } = useFormFields(([fields, dispatch]) => ({
    assetId: fields.assetId,
    setAssetId: (value: string) => dispatch({ type: 'UPDATE', path: 'assetId', value }),
    title: fields.title,
    setTitle: (value: string) => dispatch({ type: 'UPDATE', path: 'title', value }),
    setFile: (value: File) => dispatch({ type: 'UPDATE', path: 'file', value }),
    playbackUrl: fields['playbackOptions.0.playbackUrl']?.value as string | undefined,
  }))

  const { submit, setProcessing } = useForm()

  const getUploadUrl = useCallback(async () => {
    const response = await fetch(`${apiUrl}/mux/upload`, { method: 'POST' })
    const { id, url } = (await response.json()) as { id: string; url: string }
    setUploadId(id)
    return url
  }, [apiUrl])

  const onUploadStart = useCallback(
    ({ detail: { file } }: { detail: { file: File } }) => {
      const resolvedTitle = (title?.value as string) || stripExtension(file.name)
      if (!title?.value) setTitle(resolvedTitle)
      setFile(new File([], resolvedTitle, { type: file.type, lastModified: file.lastModified }))
    },
    [title?.value, setTitle, setFile],
  )

  const onSuccess = useCallback(async () => {
    setProcessing(true)

    const fetchUpload = async () => (await fetch(`${apiUrl}/mux/upload?id=${uploadId}`)).json()
    let upload = await fetchUpload()
    // The asset_id may lag the upload by a moment; poll until Mux assigns it.
    while (!upload.asset_id) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      upload = await fetchUpload()
    }

    const { asset_id } = upload
    setAssetId(asset_id)
    // Defer the submit so the assetId dispatch is flushed first.
    setTimeout(() => submit({ overrides: { assetId: asset_id } }), 0)
  }, [apiUrl, uploadId, setAssetId, setProcessing, submit])

  // Hide Payload's default `.file-field` for this collection (can't do this in CSS without
  // also hiding file fields on other collections).
  useEffect(() => {
    const fileField = document.querySelector('.file-field') as HTMLElement | null
    if (fileField) fileField.style.display = 'none'
  }, [])

  return (
    <div className="mux-uploader">
      {!assetId?.value && <MuxUploader endpoint={getUploadUrl} onUploadStart={onUploadStart} onSuccess={onSuccess} />}
      {Boolean(assetId?.value) && !playbackUrl && (
        <div className="mux-uploader__processing">
          Video is being encoded. This typically takes less than 90 seconds, please refresh the page in a moment
        </div>
      )}
      {playbackUrl && <MuxPlayer src={playbackUrl} streamType="on-demand" style={{ height: '60vh' }} />}
    </div>
  )
}

export default MuxUploaderField
