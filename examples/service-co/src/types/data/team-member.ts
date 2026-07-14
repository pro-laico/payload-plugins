import type { RelId } from './primitives'

export type TeamMember = { id: RelId; name: string; role?: string | null; bio?: string | null; order?: number | null; photo?: RelId | null }
