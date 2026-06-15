export const isImageUrl = (u: string) => /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(u)
export const isPdfUrl = (u: string) => /\.pdf(\?|$)/i.test(u)

// Small cover thumbnail for an uploaded document — the image itself for images,
// the first page for PDFs, otherwise a file-type badge.
export default function DocThumb({ url }: { url: string | null }) {
  const box = 'h-16 w-12 shrink-0 overflow-hidden rounded border border-slate-200'
  if (!url || !url.startsWith('http')) {
    return <div className={`${box} flex items-center justify-center bg-slate-50 text-[9px] text-slate-400`}>—</div>
  }
  if (isImageUrl(url)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt="" className={`${box} object-cover`} />
    )
  }
  if (isPdfUrl(url)) {
    return (
      <div className={`${box} relative bg-white`}>
        <iframe
          src={`${url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
          title=""
          tabIndex={-1}
          scrolling="no"
          className="pointer-events-none absolute left-0 top-0 h-[160px] w-[120px] origin-top-left scale-[0.4] border-0"
        />
      </div>
    )
  }
  const ext = (url.split('?')[0].split('.').pop() || 'file').toUpperCase().slice(0, 4)
  return <div className={`${box} flex items-center justify-center bg-slate-50 text-[9px] font-medium text-slate-500`}>{ext}</div>
}
