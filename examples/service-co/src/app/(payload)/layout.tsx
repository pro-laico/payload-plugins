/* THIS FILE WAS GENERATED AUTOMATICALLY BY PAYLOAD. */
/* DO NOT MODIFY IT BECAUSE IT COULD BE REWRITTEN AT ANY TIME. */
import config from '@payload-config'
import '@payloadcms/next/css'

import { handleServerFunctions, RootLayout } from '@payloadcms/next/layouts'
import { DevToolbar } from '@pro-laico/payload-dev-tools/toolbar'
import type { ServerFunctionClient } from 'payload'
import type React from 'react'
import { devLinks } from '@/dev/links'
import { devTests } from '@/dev/tests'
import { importMap } from './admin/importMap.js'
import './custom.scss'

type Args = {
  children: React.ReactNode
}

const serverFunction: ServerFunctionClient = async (args) => {
  'use server'
  return handleServerFunctions({ ...args, config, importMap })
}

// The dev toolbar rides along in the admin too — same controller everywhere. Tests are safe to
// pass here: selecting a version just navigates to its /dev/tests page (rendered by the frontend
// layout), nothing renders inside the admin.
const Layout = ({ children }: Args) => (
  <RootLayout config={config} importMap={importMap} serverFunction={serverFunction}>
    {children}
    <DevToolbar tests={devTests} links={devLinks} />
  </RootLayout>
)

export default Layout
