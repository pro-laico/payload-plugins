'use client'

import MuxPlayer from '@mux/mux-player-react'
import MuxUploader from '@mux/mux-uploader-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast, useConfig, useForm, useFormFields } from '@payloadcms/ui'

import { isRecord } from '../_kit'
import './mux-uploader.css'

const stripExtension = (name: string): string => name.replace(/\.[^./\\]+$/, '')

const stringValue = (field: { value?: unknown } | undefined): string | undefined => (typeof field?.value === 'string' ? field.value : undefined)

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
    playbackUrl: stringValue(fields['playbackOptions.0.playbackUrl']),
    status: stringValue(fields.status),
    error: stringValue(fields.error),
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
    const data: unknown = await response.json()
    const id = isRecord(data) && typeof data.id === 'string' ? data.id : ''
    const url = isRecord(data) && typeof data.url === 'string' ? data.url : ''
    setUploadId(id)
    return url
  }, [apiUrl])

  const onUploadStart = useCallback(
    ({ detail: { file } }: { detail: { file: File } }) => {
      const resolvedTitle = stringValue(title) || stripExtension(file.name)
      if (!title?.value) setTitle(resolvedTitle)
      setFile(new File([], resolvedTitle, { type: file.type, lastModified: file.lastModified }))
    },
    [title?.value, setTitle, setFile],
  )

  const onSuccess = useCallback(async () => {
    setProcessing(true)

    const fetchUpload = async () => (await fetch(`${apiUrl}/mux/upload?id=${uploadId}`)).json()
    let upload = await fetchUpload()
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
    setTimeout(() => submit({ overrides: { assetId: asset_id } }), 0)
  }, [apiUrl, uploadId, setAssetId, setProcessing, submit])

  useEffect(() => {
    const fileField = containerRef.current?.closest('form')?.querySelector('.file-field')
    if (fileField instanceof HTMLElement) fileField.style.display = 'none'
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
