import type React from 'react'

export interface IconProps extends React.SVGAttributes<SVGSVGElement> {
  name: string
  fallback?: string
}
