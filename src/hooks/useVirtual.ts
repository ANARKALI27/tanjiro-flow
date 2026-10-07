import { useEffect, useRef, useState } from 'react'

export interface VirtualResult {
  /** Index of the first row to render. */
  start: number
  /** Index one past the last row to render. */
  end: number
  /** Total scrollable height, in px. */
  totalHeight: number
  /** Translate offset for the rendered slice. */
  offset: number
}

/**
 * A minimal fixed-height virtualizer.
 *
 * Deliberately hand-rolled rather than pulled from a package: the whole thing
 * is ~40 lines, it has no dependency to keep in step with React, and a folder
 * with 50,000 files needs exactly this and nothing more.
 */
export function useVirtual(
  scrollRef: React.RefObject<HTMLElement | null>,
  itemCount: number,
  rowHeight: number,
  columns = 1,
  overscan = 6,
): VirtualResult {
  const [scrollTop, setScrollTop] = useState(0)
  const [viewport, setViewport] = useState(800)
  const frame = useRef(0)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const onScroll = () => {
      // Coalesce to one update per frame — scroll fires far faster than React
      // can usefully re-render.
      cancelAnimationFrame(frame.current)
      frame.current = requestAnimationFrame(() => setScrollTop(el.scrollTop))
    }
    const observer = new ResizeObserver(() => setViewport(el.clientHeight))

    el.addEventListener('scroll', onScroll, { passive: true })
    observer.observe(el)
    setViewport(el.clientHeight)

    return () => {
      el.removeEventListener('scroll', onScroll)
      observer.disconnect()
      cancelAnimationFrame(frame.current)
    }
  }, [scrollRef])

  const rows = Math.ceil(itemCount / columns)
  const firstRow = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan)
  const visibleRows = Math.ceil(viewport / rowHeight) + overscan * 2
  const lastRow = Math.min(rows, firstRow + visibleRows)

  return {
    start: firstRow * columns,
    end: Math.min(itemCount, lastRow * columns),
    totalHeight: rows * rowHeight,
    offset: firstRow * rowHeight,
  }
}
