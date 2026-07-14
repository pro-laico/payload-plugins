import type { Test } from '../harness/harness'

export type DevLink = { href: string; title: string }

export type DevToolbarProps = { tests?: Test[]; links?: DevLink[]; enabled?: boolean }
