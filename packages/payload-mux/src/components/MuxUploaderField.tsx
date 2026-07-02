'use client'

import MuxPlayer from '@mux/mux-player-react'
import MuxUploader from '@mux/mux-uploader-react'
import { toast, useConfig, useForm, useFormFields } from '@payloadcms/ui'
import { useCallback, useEffect, useRef, useState } from 'react'
import './mux-uploader.css'

/** Strip the extension from a filename (`clip.final.mp4` → `clip.final`). */
const stripExtension = (name: string): string => name.replace(/\.[^./\\]+$/, '')

/**
 * The admin Field for the `muxUploader` UI field. Four states: an uploader before a video
 * exists, a "processing" notice while Mux encodes, an error notice when Mux rejected the
 * upload (`status: 'errored'`), and the Mux player once a playback URL is available. Uploads
 * go directly to Mux via a direct-upload URL the plugin's endpoint mints.
 */
export const MuxUploaderField = () => {
  const { config } = useConfig()
  const apiUrl = config.routes.api

  const [uploadId, setUploadId] = useState('')
  const { assetId, setAssetId, title, setTitle, setFile, playbackUrl, status, error } = useFormFields(([fields, dispatch]) => ({
    assetId: fields.assetId,
    setAssetId: (value: string) => dispatch({ type: 'UPDATE', path: 'assetId', value }),
    title: fields.title,
    setTitle: (value: string) => dispatch({ type: 'UPDATE', path: 'title', value }),
    setFile: (value: File) => dispatch({ type: 'UPDATE', path: 'file', value }),
    playbackUrl: fields['playbackOptions.0.playbackUrl']?.value as string | undefined,
    status: fields.status?.value as string | undefined,
    error: fields.error?.value as string | undefined,
  }))

  const { submit, setProcessing } = useForm()
  const containerRef = useRef<HTMLDivElement>(null)

  const getUploadUrl = useCallback(async () => {
    const response = await fetch(`${apiUrl}/mux/upload`, { method: 'POST' })
    if (!response.ok) {
      const body = (await response.text()).slice(0, 200)
      toast.error(`Could not create a Mux upload (${response.status}): ${body}`)
      throw new Error(`[payload-mux] upload URL request failed (${response.status}): ${body}`)
    }
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
    // The asset_id may lag the upload by a moment; poll until Mux assigns it — but bound it so a
    // stuck/errored upload can't hang the form on "processing" forever.
    const deadline = Date.now() + 60_000
    while (!upload.asset_id && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      upload = await fetchUpload()
    }

    if (!upload.asset_id) {
      setProcessing(false)
      toast.error('The upload did not produce a Mux asset id within 60 seconds — please try again.')
      return
    }

    const { asset_id } = upload
    setAssetId(asset_id)
    // Defer the submit so the assetId dispatch is flushed first.
    setTimeout(() => submit({ overrides: { assetId: asset_id } }), 0)
  }, [apiUrl, uploadId, setAssetId, setProcessing, submit])

  // Hide Payload's default `.file-field` (present only when extending an upload collection),
  // scoped to this field's own form so it can't hide a file field elsewhere on the page.
  useEffect(() => {
    const fileField = containerRef.current?.closest('form')?.querySelector('.file-field') as HTMLElement | null
    if (fileField) fileField.style.display = 'none'
  }, [])

  return (
    <div className="mux-uploader" ref={containerRef}>
      {!assetId?.value && <MuxUploader endpoint={getUploadUrl} onUploadStart={onUploadStart} onSuccess={onSuccess} />}
      {Boolean(assetId?.value) && status === 'errored' && (
        <div className="mux-uploader__error">
          Mux could not process this video{error ? `: ${error}` : ''}. Delete this video and upload it again.
        </div>
      )}
      {Boolean(assetId?.value) && !playbackUrl && status !== 'errored' && (
        <div className="mux-uploader__processing">
          Video is being encoded. This typically takes less than 90 seconds, please refresh the page in a moment. If this persists, ensure your
          Mux webhook points at {`${apiUrl}/mux/webhook`} (see docs)
        </div>
      )}
      {playbackUrl && <MuxPlayer src={playbackUrl} streamType="on-demand" style={{ height: '60vh' }} />}
    </div>
  )
}

export default MuxUploaderField
