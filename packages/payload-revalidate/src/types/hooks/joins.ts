export interface JoinMembership {
  /** The relationship field on the child collection whose value names the parent doc. */
  on: string
  /** Child fields referenced by the join's `where` filter. A change to one flips the child
   *  in/out of the filtered membership, so it busts the parent's join tag even without a
   *  reassignment. (Order-only `sort` determinants are intentionally not tracked.) */
  determinants: string[]
}
