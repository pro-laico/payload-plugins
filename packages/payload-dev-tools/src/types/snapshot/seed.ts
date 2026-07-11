/** The shape the seed plugin's endpoint returns on failure — surfaced by the toolbar's Seed view
 *  and the `/dev` index seed card. */
export type SeedError = { error: string; issues?: string[] }
