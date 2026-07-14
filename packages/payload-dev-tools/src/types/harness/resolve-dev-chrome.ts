import type { ReactNode } from 'react'

import type { Test } from './harness'

export type ResolveDevChromeOptions = { tests: Test[]; header: ReactNode; footer: ReactNode; enabled?: boolean }
