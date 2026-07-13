'use client'

import { useDocumentInfo, useField, useForm, useUploadEdits } from '@payloadcms/ui'
import type React from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { BlurhashTile, WebpTile } from './tiles'
import { chipStyle, handleStyle, note, selectStyle, tileLabelStyle } from './styles'
import { clamp, windowCss } from '../../../lib/transform/geometry'
import { encodeBlurhashFromImageSource } from '../../../lib/placeholders/encodeFromCanvas'
import type { DisplayMode, DragMode, FocalPreviewProps, HotspotOpts, ParsedBlurhash } from '../../../types'
import {
  BLURHASH_QUALITIES,
  BLURHASH_TIERS,
  isPlaceholderQuality,
  isWebpQuality,
  type PlaceholderQuality,
  WEBP_QUALITIES,
  WEBP_TIERS,
} from '../../../lib/placeholders/qualities'

/**
 * The image's art-direction editor: an inline focal/hotspot/crop picker + live ratio previews.
 * It ENHANCES Payload's native focal pipeline — the focal point writes through the shared
 * `UploadEdits` context, while the hotspot size and crop rect write their own stored fields.
 * All three layers are non-destructive (the original file is never touched), and the tiles share
 * the transform endpoint's `hotspotWindow` math via `windowCss`, so preview, placeholder, and
 * endpoint renderings always agree. No network calls.
 */
const DEFAULT_RATIOS = ['16:9', '9:16', '1:1', '4:3', '3:2', '21:9']

const clampPct = (n: number): number => clamp(n, 0, 100)

const TIER_OPTIONS: PlaceholderQuality[] = [...BLURHASH_TIERS, ...WEBP_TIERS]
const tierLabel = (q: PlaceholderQuality): string =>
  isWebpQuality(q) ? `${q} · webp ${WEBP_QUALITIES[q]}px` : `${q} · ${BLURHASH_QUALITIES[q][0]}×${BLURHASH_QUALITIES[q][1]}`

const DISPLAY_MODES: DisplayMode[] = ['normal', 'half', 'blurhash']
const MODE_LABELS: Record<DisplayMode, string> = { normal: 'Normal', half: 'Half & half', blurhash: 'Placeholder' }
const isDisplayMode = (v: string): v is DisplayMode => v in MODE_LABELS

const parseRatio = (r: string): number => {
  const [rw, rh] = r.split(/[:/]/).map(Number)
  return rw && rh ? rw / rh : 1
}

export const FocalPreview: React.FC<FocalPreviewProps> = ({ previewRatios = DEFAULT_RATIOS, readOnly }) => {
  const { data } = useDocumentInfo()
  const { value: file } = useField<File | undefined>({ path: 'file' })
  const { uploadEdits, updateUploadEdits } = useUploadEdits()
  const { setModified } = useForm()

  const focalSizeField = useField<number>({ path: 'focalSize' })
  const cropLeftField = useField<number>({ path: 'cropLeft' })
  const cropTopField = useField<number>({ path: 'cropTop' })
  const cropRightField = useField<number>({ path: 'cropRight' })
  const cropBottomField = useField<number>({ path: 'cropBottom' })

  const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
  const focalSize = num(focalSizeField.value, num(data?.focalSize, 100))
  const cropLeft = num(cropLeftField.value, num(data?.cropLeft, 0))
  const cropTop = num(cropTopField.value, num(data?.cropTop, 0))
  const cropRight = num(cropRightField.value, num(data?.cropRight, 0))
  const cropBottom = num(cropBottomField.value, num(data?.cropBottom, 0))

  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  useEffect(() => {
    if (file instanceof File && file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file)
      setObjectUrl(url)
      return () => URL.revokeObjectURL(url)
    }
    setObjectUrl(null)
    return undefined
  }, [file])

  const savedUrl = typeof data?.url === 'string' ? data.url : null
  const src = savedUrl || objectUrl

  const focalX = uploadEdits?.focalPoint?.x ?? (typeof data?.focalX === 'number' ? data.focalX : 50)
  const focalY = uploadEdits?.focalPoint?.y ?? (typeof data?.focalY === 'number' ? data.focalY : 50)

  const hotspot: HotspotOpts = { focalX, focalY, focalSize, cropLeft, cropTop, cropRight, cropBottom }

  const [srcDims, setSrcDims] = useState<{ w: number; h: number } | null>(
    typeof data?.width === 'number' && typeof data?.height === 'number' ? { w: data.width, h: data.height } : null,
  )

  const [hash, setHash] = useState<ParsedBlurhash | null>(null)
  const [mode, setMode] = useState<DisplayMode>('normal')
  const [quality, setQuality] = useState<PlaceholderQuality>('sm')
  const [dialogRatio, setDialogRatio] = useState<string | null>(null)
  useEffect(() => {
    if (!src) {
      setHash(null)
      return
    }
    let cancelled = false
    encodeBlurhashFromImageSource(src)
      .then((parsed) => {
        if (!cancelled) setHash(parsed)
      })
      .catch(() => {
        if (!cancelled) setHash(null)
      })
    return () => {
      cancelled = true
    }
  }, [src])

  useEffect(() => {
    if (!dialogRatio) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setDialogRatio(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dialogRatio])

  const stageRef = useRef<HTMLDivElement>(null)
  const dragMode = useRef<DragMode>(null)
  const [handleAngle, setHandleAngle] = useState(Math.PI / 4)

  const setCrop = useCallback(
    (side: 'nw' | 'se', xPct: number, yPct: number) => {
      if (side === 'nw') {
        cropLeftField.setValue(Math.round(clamp(xPct, 0, 90 - cropRight)))
        cropTopField.setValue(Math.round(clamp(yPct, 0, 90 - cropBottom)))
      } else {
        cropRightField.setValue(Math.round(clamp(100 - xPct, 0, 90 - cropLeft)))
        cropBottomField.setValue(Math.round(clamp(100 - yPct, 0, 90 - cropTop)))
      }
      setModified(true)
    },
    [cropLeft, cropTop, cropRight, cropBottom, cropLeftField, cropTopField, cropRightField, cropBottomField, setModified],
  )

  const applyFromEvent = useCallback(
    (clientX: number, clientY: number) => {
      if (readOnly) return
      const el = stageRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      const xPct = clampPct(((clientX - rect.left) / rect.width) * 100)
      const yPct = clampPct(((clientY - rect.top) / rect.height) * 100)

      const dm = dragMode.current
      if (dm === 'crop-nw' || dm === 'crop-se') {
        setCrop(dm === 'crop-nw' ? 'nw' : 'se', xPct, yPct)
        return
      }
      if (dm === 'size') {
        const fxPx = (focalX / 100) * rect.width
        const fyPx = (focalY / 100) * rect.height
        const dx = clientX - rect.left - fxPx
        const dy = clientY - rect.top - fyPx
        const dist = Math.hypot(dx, dy)
        if (dist > 1) setHandleAngle(Math.atan2(dy, dx))
        const regionW = rect.width * (1 - (cropLeft + cropRight) / 100)
        const regionH = rect.height * (1 - (cropTop + cropBottom) / 100)
        const shorter = Math.max(1, Math.min(regionW, regionH))
        focalSizeField.setValue(Math.round(clamp((dist * 2 * 100) / shorter, 5, 100)))
        setModified(true)
        return
      }
      const x = clamp(xPct, cropLeft, 100 - cropRight)
      const y = clamp(yPct, cropTop, 100 - cropBottom)
      updateUploadEdits({ ...uploadEdits, focalPoint: { x, y } })
      setModified(true)
    },
    [readOnly, uploadEdits, updateUploadEdits, setModified, setCrop, focalX, focalY, focalSizeField, cropLeft, cropTop, cropRight, cropBottom],
  )

  if (!src)
    return (
      <div style={{ marginBottom: '1rem' }}>
        <strong style={{ fontSize: '0.95rem' }}>Focus &amp; crop</strong>
        <p style={note}>Upload an image to set its focus point, hotspot size, and crop.</p>
      </div>
    )

  // Stage-space hotspot circle: diameter = focalSize% of the crop region's shorter side in
  // DISPLAY px — the shorter region side in units of stage WIDTH (height in width-units = 1/stageAr).
  const stageAr = srcDims ? srcDims.w / srcDims.h : 3 / 2
  const regionWpct = 1 - (cropLeft + cropRight) / 100
  const regionHpct = 1 - (cropTop + cropBottom) / 100
  const shorterWidthUnits = Math.min(regionWpct, regionHpct / stageAr)
  const circleDiaPctOfWidth = focalSize * shorterWidthUnits

  const hasCrop = cropLeft > 0 || cropTop > 0 || cropRight > 0 || cropBottom > 0

  const startDrag = (m: Exclude<DragMode, null>) => (e: React.PointerEvent) => {
    if (readOnly) return
    dragMode.current = m
    e.stopPropagation()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    if (m !== 'focal') return
    applyFromEvent(e.clientX, e.clientY)
  }

  /** One ratio preview surface (image window + optional placeholder overlay + label chip). */
  const tileSurface = (r: string): React.ReactElement => {
    const tileAr = parseRatio(r)
    const css = srcDims ? windowCss(srcDims.w, srcDims.h, tileAr, hotspot) : null
    const placeholderReady = srcDims != null && (isWebpQuality(quality) || hash != null)
    const showImage = mode !== 'blurhash' || !placeholderReady
    const showPlaceholder = mode !== 'normal' && placeholderReady && srcDims
    return (
      <>
        {showImage &&
          (css ? (
            /* biome-ignore lint/performance/noImgElement: intentional plain <img> — admin preview that mirrors the frontend's crop */
            <img
              src={src}
              alt=""
              draggable={false}
              style={{
                position: 'absolute',
                left: `${css.left}%`,
                top: `${css.top}%`,
                width: `${css.width}%`,
                height: 'auto',
                maxWidth: 'none',
              }}
            />
          ) : (
            /* biome-ignore lint/performance/noImgElement: fallback before natural dims are known */
            <img src={src} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ))}
        {showPlaceholder && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              ...(mode === 'half' ? { clipPath: 'inset(0 0 0 50%)', borderLeft: '1px solid rgba(255,255,255,0.6)' } : null),
            }}
          >
            {isWebpQuality(quality) ? (
              <WebpTile src={src} srcAr={srcDims.w / srcDims.h} tileAr={tileAr} hotspot={hotspot} quality={quality} />
            ) : (
              hash && <BlurhashTile hash={hash} srcAr={srcDims.w / srcDims.h} tileAr={tileAr} hotspot={hotspot} quality={quality} />
            )}
          </div>
        )}
        <span style={tileLabelStyle}>{r}</span>
      </>
    )
  }

  const modeSelect = (
    <select
      aria-label="Preview display mode"
      value={mode}
      onChange={(e) => {
        if (isDisplayMode(e.target.value)) setMode(e.target.value)
      }}
      style={selectStyle}
    >
      {DISPLAY_MODES.map((m) => (
        <option key={m} value={m} disabled={m !== 'normal' && !srcDims}>
          {MODE_LABELS[m]}
        </option>
      ))}
    </select>
  )

  const qualitySelect = (
    <select
      aria-label="Placeholder quality tier"
      value={quality}
      onChange={(e) => {
        if (isPlaceholderQuality(e.target.value)) setQuality(e.target.value)
      }}
      disabled={mode === 'normal'}
      style={{ ...selectStyle, ...(mode === 'normal' ? { opacity: 0.45, cursor: 'default' } : null) }}
    >
      {TIER_OPTIONS.map((q) => (
        <option key={q} value={q} disabled={!isWebpQuality(q) && !hash}>
          {tierLabel(q)}
        </option>
      ))}
    </select>
  )

  return (
    <div
      style={{
        marginBottom: '1rem',
        padding: '0.75rem',
        maxWidth: 760,
        borderRadius: 'var(--style-radius-m, 4px)',
        border: '1px solid var(--theme-elevation-100)',
        background: 'var(--theme-elevation-50)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
        <strong style={{ fontSize: '0.95rem' }}>Focus &amp; crop</strong>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          <span style={chipStyle} title="Hotspot circle diameter — smaller zooms in">
            Hotspot {Math.round(focalSize)}%
          </span>
          {modeSelect}
          {qualitySelect}
          {!readOnly && (hasCrop || focalSize < 100) && (
            <button
              type="button"
              onClick={() => {
                focalSizeField.setValue(100)
                cropLeftField.setValue(0)
                cropTopField.setValue(0)
                cropRightField.setValue(0)
                cropBottomField.setValue(0)
                setModified(true)
              }}
              style={{ ...selectStyle, cursor: 'pointer' }}
            >
              Reset
            </button>
          )}
        </div>
      </div>
      <p style={{ ...note, margin: '0.35rem 0 0.6rem' }}>
        {readOnly
          ? 'Focus point, hotspot, and crop (read-only).'
          : 'Click to set the focus point · drag the circle’s handle to zoom · drag the corners to crop. Non-destructive: the original file is never modified. Click a preview to inspect it.'}
      </p>

      <div>
        {/* Center the stage so a tall (1:1 / portrait) image capped by max-height isn't left-anchored. */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div
            ref={stageRef}
            onPointerDown={(e) => {
              if (readOnly) return
              dragMode.current = 'focal'
              e.currentTarget.setPointerCapture(e.pointerId)
              applyFromEvent(e.clientX, e.clientY)
            }}
            onPointerMove={(e) => {
              if (dragMode.current) applyFromEvent(e.clientX, e.clientY)
            }}
            onPointerUp={(e) => {
              dragMode.current = null
              e.currentTarget.releasePointerCapture?.(e.pointerId)
            }}
            style={{
              position: 'relative',
              // Shrink-to-fit the (height-capped) image, but never past the panel width — minWidth:0
              // defeats the flex min-content floor that would otherwise let a wide image overflow.
              maxWidth: '100%',
              minWidth: 0,
              borderRadius: 'var(--style-radius-m, 4px)',
              overflow: 'hidden',
              border: '1px solid var(--theme-elevation-150)',
              cursor: readOnly ? 'default' : 'crosshair',
              touchAction: 'none',
            }}
          >
            {/* biome-ignore lint/performance/noImgElement: intentional plain <img> — admin preview that mirrors the frontend's crop */}
            <img
              src={src}
              alt=""
              onLoad={(e) => setSrcDims({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              style={{ display: 'block', width: 'auto', height: 'auto', maxWidth: '100%', maxHeight: 'min(60vh, 560px)' }}
              draggable={false}
            />

            <div
              aria-hidden
              style={{
                position: 'absolute',
                left: `${cropLeft}%`,
                top: `${cropTop}%`,
                right: `${cropRight}%`,
                bottom: `${cropBottom}%`,
                boxShadow: '0 0 0 100000px rgba(0, 0, 0, 0.55)',
                border: hasCrop ? '1px dashed rgba(255,255,255,0.85)' : 'none',
                pointerEvents: 'none',
                zIndex: 1,
              }}
            />

            <span
              aria-hidden
              style={{
                position: 'absolute',
                left: `${focalX}%`,
                top: `${focalY}%`,
                width: `${circleDiaPctOfWidth}%`,
                aspectRatio: '1',
                transform: 'translate(-50%, -50%)',
                borderRadius: '50%',
                border: '2px solid var(--theme-success-500, #22c55e)',
                boxShadow: '0 0 0 1px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(0,0,0,0.35)',
                pointerEvents: 'none',
                zIndex: 2,
              }}
            />
            <span
              aria-hidden
              style={{
                position: 'absolute',
                left: `${focalX}%`,
                top: `${focalY}%`,
                width: 8,
                height: 8,
                transform: 'translate(-50%, -50%)',
                borderRadius: '50%',
                background: 'var(--theme-success-500, #22c55e)',
                boxShadow: '0 0 0 2px rgba(0,0,0,0.5)',
                pointerEvents: 'none',
                zIndex: 2,
              }}
            />
            {!readOnly && (
              <>
                <span
                  role="slider"
                  tabIndex={0}
                  aria-label="Hotspot size"
                  aria-valuemin={5}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(focalSize)}
                  onPointerDown={startDrag('size')}
                  style={{
                    ...handleStyle,
                    width: 24,
                    height: 24,
                    left: `calc(${focalX}% + ${(circleDiaPctOfWidth / 2) * Math.cos(handleAngle)}%)`,
                    top: `calc(${focalY}% + ${(circleDiaPctOfWidth / 2) * stageAr * Math.sin(handleAngle)}%)`,
                    transform: 'translate(-50%, -50%)',
                    borderRadius: '50%',
                    cursor: 'grab',
                  }}
                />
                <span
                  role="slider"
                  tabIndex={0}
                  aria-label="Crop top-left"
                  aria-valuemin={0}
                  aria-valuemax={90}
                  aria-valuenow={Math.round(Math.max(cropLeft, cropTop))}
                  onPointerDown={startDrag('crop-nw')}
                  style={{
                    ...handleStyle,
                    left: `${cropLeft}%`,
                    top: `${cropTop}%`,
                    transform: 'translate(-50%, -50%)',
                    cursor: 'nwse-resize',
                  }}
                />
                <span
                  role="slider"
                  tabIndex={0}
                  aria-label="Crop bottom-right"
                  aria-valuemin={0}
                  aria-valuemax={90}
                  aria-valuenow={Math.round(Math.max(cropRight, cropBottom))}
                  onPointerDown={startDrag('crop-se')}
                  style={{
                    ...handleStyle,
                    left: `${100 - cropRight}%`,
                    top: `${100 - cropBottom}%`,
                    transform: 'translate(-50%, -50%)',
                    cursor: 'nwse-resize',
                  }}
                />
              </>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem' }}>
          {previewRatios.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setDialogRatio(r)}
              aria-label={`Inspect the ${r} preview`}
              style={{
                position: 'relative',
                overflow: 'hidden',
                flex: `${parseRatio(r)} 1 0%`,
                aspectRatio: String(parseRatio(r)),
                padding: 0,
                borderRadius: 'var(--style-radius-s, 3px)',
                border: '1px solid var(--theme-elevation-100)',
                background: 'var(--theme-elevation-50)',
                cursor: 'zoom-in',
              }}
            >
              {tileSurface(r)}
            </button>
          ))}
        </div>
      </div>

      {dialogRatio && (
        // biome-ignore lint/a11y/useKeyWithClickEvents: Escape is handled globally while open
        // biome-ignore lint/a11y/noStaticElementInteractions: backdrop click-to-close supplements Escape and the ✕ button
        <div
          role="presentation"
          onClick={() => setDialogRatio(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem 1rem',
          }}
        >
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: the click handler only stops backdrop-close propagation */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${dialogRatio} preview`}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--theme-elevation-50)',
              border: '1px solid var(--theme-elevation-150)',
              borderRadius: 'var(--style-radius-m, 4px)',
              padding: '0.75rem',
              maxWidth: 'min(920px, 94vw)',
              width: parseRatio(dialogRatio) >= 1 ? 'min(920px, 94vw)' : 'auto',
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
              <strong style={{ fontSize: '0.9rem' }}>{dialogRatio}</strong>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                {modeSelect}
                {qualitySelect}
                <button
                  type="button"
                  onClick={() => setDialogRatio(null)}
                  aria-label="Close preview"
                  style={{ ...selectStyle, cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>
            </div>
            <div
              style={{
                position: 'relative',
                overflow: 'hidden',
                aspectRatio: String(parseRatio(dialogRatio)),
                ...(parseRatio(dialogRatio) >= 1 ? { width: '100%' } : { height: 'min(78vh, 720px)' }),
                borderRadius: 'var(--style-radius-s, 3px)',
                border: '1px solid var(--theme-elevation-100)',
              }}
            >
              {tileSurface(dialogRatio)}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default FocalPreview
