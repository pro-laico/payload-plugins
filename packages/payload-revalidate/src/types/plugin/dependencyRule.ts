export interface DependencyRule {
  on: string
  bust: string[]
  whenFields?: string[]
}
