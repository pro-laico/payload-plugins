'use client'

import MuxPlayer from '@mux/mux-player-react'
import MuxUploader from '@mux/mux-uploader-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast, useConfig, useDocumentInfo, useForm, useFormFields, useFormModified } from '@payloadcms/ui'

import { isRecord } from '../_kit'
import './mux-uploader.css'

// Encoding finishes on Mux's schedule and arrives as a webhook, so the open edit view has no reason
// to re-render — it sat on "being encoded" until the editor reloaded by hand, which reads as stuck.
// Watch the document instead, and stop once it's plainly no longer a timing question: a 4K source
// can take several minutes, but past this it's worth naming the webhook as the suspect.
const POLL_INTERVAL_MS = 5000
const POLL_LIMIT_MS = 10 * 60 * 1000

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
  const { id } = useDocumentInfo()
  const modified = useFormModified()
  const containerRef = useRef<HTMLDivElement>(null)
  const [encodeTimedOut, setEncodeTimedOut] = useState(false)
  const [encodedWhileEditing, setEncodedWhileEditing] = useState(false)

  // Keyed on status, not on having a playback URL: Mux assigns the playback id when it creates the
  // asset, so the document carries one well before the video is playable. Showing the player then
  // would mount it against a stream Mux still refuses (412).
  const encoding = Boolean(assetId?.value) && status !== 'ready' && status !== 'errored'

  // Encoding finishes as a webhook, which an open edit view never hears — and in local development
  // Mux can't reach the machine at all, so the webhook never comes. Ask the server instead; it
  // checks Mux and writes only when the answer changed. Reload rather than patch the form: the
  // playback array row doesn't exist client-side yet, and a reload is what the editor would have
  // done by hand. Never while the form is dirty — that would discard edits, so say so instead.
  useEffect(() => {
    if (!encoding || id == null) return
    const deadline = Date.now() + POLL_LIMIT_MS
    let timer: ReturnType<typeof setInterval> | undefined
    const stop = () => clearInterval(timer)

    const check = async () => {
      if (Date.now() > deadline) {
        stop()
        setEncodeTimedOut(true)
        return
      }
      try {
        const res = await fetch(`${apiUrl}/mux/refresh?id=${encodeURIComponent(String(id))}`, { credentials: 'include' })
        if (!res.ok) return
        const body: unknown = await res.json()
        if (!isRecord(body) || (body.status !== 'ready' && body.status !== 'errored')) return
        stop()
        if (modified) setEncodedWhileEditing(true)
        else window.location.reload()
      } catch {
        // A dropped poll isn't worth surfacing — the next tick tries again.
      }
    }

    timer = setInterval(check, POLL_INTERVAL_MS)
    return stop
  }, [encoding, id, apiUrl, modified])

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
    [title, setTitle, setFile],
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
      {encoding && encodedWhileEditing && (
        <div className="mux-uploader__processing">Encoding finished. Save your changes to see the video — reloading now would lose them.</div>
      )}
      {encoding && !encodedWhileEditing && !encodeTimedOut && (
        <div className="mux-uploader__processing">
          Video is being encoded — usually under 90 seconds, longer for large or 4K sources. This page updates itself when Mux is done; you
          don't need to refresh.
        </div>
      )}
      {encoding && encodeTimedOut && (
        <div className="mux-uploader__processing">
          Still encoding after 10 minutes, which is longer than Mux usually takes. Check the asset in the Mux dashboard; saving this document
          re-checks Mux directly and will heal it.
        </div>
      )}
      {!encoding && playbackUrl && <MuxPlayer src={playbackUrl} streamType="on-demand" style={{ height: '60vh' }} />}
    </div>
  )
}

export default MuxUploaderField
