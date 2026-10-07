import { useEffect } from 'react'

export interface HotkeyMap {
  /** Key is a combo like "ctrl+c", "shift+delete", "f2", "enter". */
  [combo: string]: (e: KeyboardEvent) => void
}

function comboFor(e: KeyboardEvent): string {
  const parts: string[] = []
  if (e.ctrlKey || e.metaKey) parts.push('ctrl')
  if (e.shiftKey) parts.push('shift')
  if (e.altKey) parts.push('alt')
  parts.push(e.key.toLowerCase())
  return parts.join('+')
}

/** True while the user is typing somewhere a shortcut would be destructive. */
function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable
}

export function useHotkeys(map: HotkeyMap, enabled = true) {
  useEffect(() => {
    if (!enabled) return
    const handler = (e: KeyboardEvent) => {
      const combo = comboFor(e)
      const fn = map[combo]
      if (!fn) return
      // Ctrl+K and Escape must work even inside an input; everything else
      // yields to whatever the user is typing into.
      const always = combo === 'ctrl+k' || combo === 'escape'
      if (!always && isTypingTarget(e.target)) return
      e.preventDefault()
      fn(e)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [map, enabled])
}
