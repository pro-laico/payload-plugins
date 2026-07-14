import { defineSeed } from '@pro-laico/payload-seed'

export default defineSeed('payload-folders', () => [
  { _key: 'site', name: 'Site', folderType: ['images'] },
  { _key: 'services', name: 'Services', folderType: ['images'] },
  { _key: 'projects', name: 'Projects', folderType: ['images'] },
  { _key: 'team', name: 'Team', folderType: ['images'] },
])
