#!/usr/bin/env node
import { runDownloadFonts } from './downloadFonts.js'

const verbose = process.argv.slice(2).some((arg) => arg === '--verbose' || arg === '-v')

runDownloadFonts({ verbose }).catch((err) => {
  console.error(err)
  process.exit(1)
})
