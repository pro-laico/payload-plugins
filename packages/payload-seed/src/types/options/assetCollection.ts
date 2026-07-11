/** A `custom.seedAsset` collection, resolved to its effective source field (subdir defaults are
 *  applied at lookup, alongside `assetSubDirs`, so they match native uploads). */
export interface AssetCollection {
  sourceField: string
  subdir?: string
}
