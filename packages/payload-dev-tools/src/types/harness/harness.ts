import type { ReactNode } from 'react'

export type TestKind = 'page' | 'header' | 'footer' | 'block' | 'custom'

export type TestVersion = { id: string; label: string; render: () => ReactNode | Promise<ReactNode> }

export type Test = { key: string; label: string; kind: TestKind; versions: TestVersion[] }

export type ActiveStage = { test: Test; version: TestVersion }

export type TestMeta = { key: string; label: string; kind: TestKind; versions: { id: string; label: string }[] }
