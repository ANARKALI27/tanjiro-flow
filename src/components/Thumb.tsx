import { useEffect, useRef, useState } from 'react'
import { api, assetUrl } from '../lib/ipc'
import { KindIcon, KIND_STYLE } from '../lib/icons'
import type { FileEntry } from '../lib/types'

/** Formats WebView2 will decode inline. Anything else gets the type icon. */
const INLINE_IMAGE = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'avif', 'ico'])

/**
 * Extensions where the generic per-kind glyph is too generic to be useful —
 * every .exe/.lnk on the desktop looked identical (same "Application"/
 * "Shortcut" icon) even though Explorer itself shows a distinct icon per
 * app. These get the real Windows icon extracted via `fs_file_icon` instead.
 */
const ICON_EXTRACT = new Set(['exe', 'lnk', 'msi', 'appx', 'msix', 'apk', 'jar', 'com', 'scr', 'url'])

/**
 * Real icon extraction is a Win32 GDI round trip per file — worth avoiding a
 * second time for the same path within a session. Shared across every
 * <Thumb>, so navigating away and back doesn't re-pay the cost.
 */
const iconCache = new Map<string, string | 'failed'>()

/**
 * A lazy thumbnail.
 *
 * Nothing loads until the tile is near the viewport, so scrolling a folder of
 * 10,000 photos doesn't try to decode 10,000 images. A decode failure falls
 * back to the icon rather than leaving a broken frame — the spec's "do not
 * crash if preview generation fails", enforced at the leaf.
 */
export function Thumb({ entry, size }: { entry: FileEntry; size?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [failed, setFailed] = useState(false)
  const [realIcon, setRealIcon] = useState<string | null>(() => {
    const cached = iconCache.get(entry.path)
    return cached && cached !== 'failed' ? cached : null
  })

  const canRender = !entry.isDir && INLINE_IMAGE.has(entry.extension) && !failed
  const canExtractIcon = !entry.isDir && !canRender && ICON_EXTRACT.has(entry.extension) && !failed

  useEffect(() => {
    if (!canRender && !canExtractIcon) return
    if (visible) return
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (items) => {
        if (items.some((i) => i.isIntersecting)) {
          setVisible(true)
          io.disconnect()
        }
      },
      { rootMargin: '300px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [canRender, canExtractIcon, visible])

  useEffect(() => {
    setFailed(false)
    const cached = iconCache.get(entry.path)
    setRealIcon(cached && cached !== 'failed' ? cached : null)
  }, [entry.path])

  useEffect(() => {
    if (!canExtractIcon || !visible || realIcon) return
    const cached = iconCache.get(entry.path)
    if (cached === 'failed') return
    if (cached) {
      setRealIcon(cached)
      return
    }
    let cancelled = false
    api
      .fileIcon(entry.path)
      .then((dataUrl) => {
        if (cancelled) return
        iconCache.set(entry.path, dataUrl)
        setRealIcon(dataUrl)
      })
      .catch(() => {
        if (cancelled) return
        iconCache.set(entry.path, 'failed')
        setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [canExtractIcon, visible, realIcon, entry.path])

  // Shown whenever a real image isn't (yet, or ever) on screen: before the
  // lazy-load intersection fires, and permanently for non-image kinds. Real
  // image thumbnails fill their box edge-to-edge (object-fit: cover), so a
  // thin, tiny fallback glyph on a bare transparent box used to read as a
  // different, smaller element next to them in the same grid — tinting the
  // tile per file-kind and filling more of it with the icon gives both cases
  // the same visual weight.
  const showImage = canRender && visible
  const showRealIcon = canExtractIcon && visible && !!realIcon
  const showKindGlyph = !showImage && !showRealIcon
  const kindStyle = KIND_STYLE[entry.kind] ?? KIND_STYLE.other
  const style: React.CSSProperties = {
    ...(size ? { width: size, height: size } : undefined),
    ...(showKindGlyph
      ? {
          ['--thumb-tint' as string]: `color-mix(in srgb, ${kindStyle.color} 16%, var(--surface-2))`,
          ['--thumb-tint-border' as string]: `color-mix(in srgb, ${kindStyle.color} 30%, var(--border))`,
        }
      : undefined),
  }

  return (
    <div className="thumb" data-plain={showKindGlyph} ref={ref} style={style}>
      {showImage ? (
        <img
          src={assetUrl(entry.path)}
          alt=""
          loading="lazy"
          draggable={false}
          onError={() => setFailed(true)}
        />
      ) : showRealIcon ? (
        <img
          src={realIcon!}
          alt=""
          draggable={false}
          style={{ objectFit: 'contain', width: '62%', height: '62%', margin: 'auto' }}
          onError={() => {
            iconCache.set(entry.path, 'failed')
            setFailed(true)
          }}
        />
      ) : (
        <KindIcon kind={entry.kind} size={size ? Math.round(size * 0.62) : 30} />
      )}
    </div>
  )
}
