import type { DefaultCellComponentProps } from 'payload'

/** List-view Cell showing a static Mux poster image (the `adminThumbnail: 'image'` mode). */
export const MuxVideoImageCell = ({ rowData }: DefaultCellComponentProps) => {
  const playbackOption = rowData?.playbackOptions?.[0]
  if (!playbackOption) return <>Preview not available.</>

  // biome-ignore lint/performance/noImgElement: admin list-view thumbnail (Mux image URL), not a Next page
  return <img style={{ width: 80, height: 80, objectFit: 'cover' }} loading="lazy" alt={rowData?.title} src={playbackOption.posterUrl} />
}

export default MuxVideoImageCell
