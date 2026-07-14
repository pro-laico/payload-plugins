import type { Payload } from 'payload'

import type { Test } from '../harness/harness'

export type CreateDevPageOptions = { payload: Payload | Promise<Payload>; tests?: Test[]; enabled?: boolean }

export type DevPageProps = { params: Promise<{ view?: string[] }>; searchParams?: Promise<Record<string, string | string[] | undefined>> }
