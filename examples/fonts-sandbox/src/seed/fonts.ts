import { defineSeed } from '@pro-laico/payload-seed'

export const fontOriginals = defineSeed('fontOriginal', ({ file }) => [
  { _key: 'inter-variable', _file: file('inter-variable.woff2') },
  { _key: 'lora', _file: file('lora.woff2') },
  { _key: 'lora-700', _file: file('lora-700.woff2') },
  { _key: 'jetbrains-mono', _file: file('jetbrains-mono.woff2') },
  { _key: 'abril-fatface', _file: file('abril-fatface.woff2') },
  { _key: 'recursive-variable', _file: file('recursive-variable.woff2') },
])

export default defineSeed('font', ({ ref }) => [
  { _key: 'inter', title: 'Inter', family: 'sans', variable: { upright: ref('fontOriginal', 'inter-variable') } },
  {
    _key: 'lora',
    title: 'Lora',
    family: 'serif',
    weights: [
      { weight: '400', style: 'normal', file: ref('fontOriginal', 'lora') },
      { weight: '700', style: 'normal', file: ref('fontOriginal', 'lora-700') },
    ],
  },
  {
    _key: 'jetbrains-mono',
    title: 'JetBrains Mono',
    family: 'mono',
    weights: [{ weight: '400', style: 'normal', file: ref('fontOriginal', 'jetbrains-mono') }],
  },
  {
    _key: 'abril-fatface',
    title: 'Abril Fatface',
    family: 'display',
    weights: [{ weight: '400', style: 'normal', file: ref('fontOriginal', 'abril-fatface') }],
  },
  { _key: 'recursive', title: 'Recursive', family: 'display', variable: { upright: ref('fontOriginal', 'recursive-variable') } },
])
