import { defineSeed } from '@pro-laico/payload-seed'

// Payload's native folders (enabled on the images collection via `imagesPlugin({ folders: true })`)
// are ordinary docs in the hidden `payload-folders` collection, so they seed like anything else.
// Each image references its folder via ref('payload-folders', <_key>) — see images.ts — which also
// orders folders before images. `folderType` scopes what a folder may contain (Payload's
// collection-specific folders are on by default).
export default defineSeed('payload-folders', () => [
  { _key: 'site', name: 'Site', folderType: ['images'] },
  { _key: 'services', name: 'Services', folderType: ['images'] },
  { _key: 'projects', name: 'Projects', folderType: ['images'] },
  { _key: 'team', name: 'Team', folderType: ['images'] },
])
