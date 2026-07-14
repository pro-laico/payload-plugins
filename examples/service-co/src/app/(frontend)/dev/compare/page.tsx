import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { getSiteSettings } from '@/lib/data'
import { ImageCompare } from '@/components/ImageCompare'
import { SectionHeading } from '@/components/SectionHeading'

export default function ComparePage() {
  if (process.env.NODE_ENV !== 'development') notFound()
  return (
    <div className="mx-auto max-w-6xl px-6 py-20">
      <SectionHeading eyebrow="Dev" title="Image vs ImageFor" />
      <Suspense fallback={null}>
        <CompareContent />
      </Suspense>
    </div>
  )
}

async function CompareContent() {
  const settings = await getSiteSettings()
  if (settings.heroImage == null) return <p className="mt-10 text-muted-foreground">No hero image set — seed the database first.</p>
  return (
    <div className="mt-12 space-y-16">
      <ImageCompare
        id={settings.heroImage}
        aspectRatio="4:3"
        sizes="(max-width: 1024px) 100vw, 560px"
        image={{ aspectRatio: '4:3', quality: 80 }}
        blur={{ quality: 'md' }}
      />
      <ImageCompare
        id={settings.heroImage}
        aspectRatio="1:1"
        sizes="(max-width: 1024px) 100vw, 560px"
        image={{ aspectRatio: '1:1', quality: 60, format: 'webp' }}
      />
    </div>
  )
}
