import type { Metadata } from 'next'
import { connection } from 'next/server'
import { Suspense } from 'react'
import { Image } from '@/components/Image'
import { SectionHeading } from '@/components/SectionHeading'
import { Icon } from '@/components/ui/Icon'
import { getIcon, getService, getServiceIds } from '@/lib/data'

export const metadata: Metadata = { title: 'Services' }

export default function ServicesPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-20">
      <SectionHeading
        eyebrow="Services"
        title="How we work"
        description="Most of our projects use more than one of these. We’re happy to lead all of it, or to slot in alongside a builder or architect you already trust."
      />
      <Suspense fallback={null}>
        <ServiceSections />
      </Suspense>
    </div>
  )
}

async function ServiceSections() {
  await connection()
  const serviceIds = await getServiceIds()
  return (
    <div className="mt-16 space-y-20">
      {serviceIds.map((id, i) => (
        <ServiceSection key={String(id)} id={id} index={i} count={serviceIds.length} />
      ))}
    </div>
  )
}

/** One service = one cache entry; its photo and glyph resolve through their own id-keyed
 *  entries, so an image recrop or icon re-upload refreshes exactly that piece. */
async function ServiceSection({ id, index, count }: { id: string | number; index: number; count: number }) {
  const service = await getService(id)
  if (!service) return null
  const icon = service.icon != null ? await getIcon(service.icon) : null
  const flip = index % 2 === 1
  return (
    <section className="grid items-center gap-10 lg:grid-cols-2">
      <div className={`overflow-hidden rounded-2xl border border-border ${flip ? 'lg:order-2' : ''}`}>
        {service.image != null ? (
          <Image id={service.image} aspectRatio="4:3" sizes="(max-width: 1024px) 100vw, 560px" quality={80} className="w-full" />
        ) : null}
      </div>
      <div className={flip ? 'lg:order-1' : ''}>
        <Icon svg={icon?.svgString} variant="outline" size="lg" className="text-primary" />
        <h2 className="mt-5 font-serif text-3xl tracking-tight text-foreground">{service.title}</h2>
        {service.summary ? <p className="mt-3 text-base leading-relaxed text-muted-foreground">{service.summary}</p> : null}
        <p className="mt-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">
          0{index + 1} / {String(count).padStart(2, '0')}
        </p>
      </div>
    </section>
  )
}
