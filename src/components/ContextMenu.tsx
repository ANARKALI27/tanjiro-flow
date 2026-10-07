import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { Icon, type IconName } from '../lib/icons'
import { useMotionScale } from '../hooks/useMotionScale'

export interface MenuItem {
  id: string
  label: string
  icon?: IconName
  hint?: string
  danger?: boolean
  disabled?: boolean
  onSelect?: () => void
  submenu?: MenuEntry[]
  separator?: false
}

export interface MenuSeparator {
  separator: true
  id: string
}

export type MenuEntry = MenuItem | MenuSeparator

function isSeparator(e: MenuEntry): e is MenuSeparator {
  return (e as MenuSeparator).separator === true
}

function Submenu({ item }: { item: MenuItem }) {
  const [open, setOpen] = useState(false)
  return (
    <div
      className="ctx-sub"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button className="ctx-item" disabled={item.disabled}>
        {item.icon && <Icon name={item.icon} size={15} />}
        <span className="ctx-label">{item.label}</span>
        <Icon name="chevronRight" size={13} />
      </button>
      {open && item.submenu && (
        <div className="ctx-submenu">
          {item.submenu.map((sub) =>
            isSeparator(sub) ? (
              <div key={sub.id} className="ctx-sep" />
            ) : (
              <button
                key={sub.id}
                className="ctx-item"
                data-danger={sub.danger}
                disabled={sub.disabled}
                onClick={sub.onSelect}
              >
                {sub.icon && <Icon name={sub.icon} size={15} />}
                <span className="ctx-label">{sub.label}</span>
                {sub.hint && <span className="ctx-hint">{sub.hint}</span>}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Tanjiro Flow's custom right-click menu. Portaled to <body> and clamped to the
 * viewport so it never gets cut off near an edge — the default browser menu
 * is suppressed everywhere this is used.
 */
export function ContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number
  y: number
  items: MenuEntry[]
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x, y })
  const scale = useMotionScale()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const clampedX = Math.min(x, window.innerWidth - rect.width - 8)
    const clampedY = Math.min(y, window.innerHeight - rect.height - 8)
    setPos({ x: Math.max(8, clampedX), y: Math.max(8, clampedY) })
  }, [x, y])

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    window.addEventListener('blur', onClose)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('blur', onClose)
    }
  }, [onClose])

  return createPortal(
    <motion.div
      ref={ref}
      className="ctx"
      style={{ left: pos.x, top: pos.y }}
      role="menu"
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ duration: 0.12 * scale, ease: [0.16, 1, 0.3, 1] }}
    >
      {items.map((item) => {
        if (isSeparator(item)) return <div key={item.id} className="ctx-sep" />
        if (item.submenu) return <Submenu key={item.id} item={item} />
        return (
          <button
            key={item.id}
            className="ctx-item"
            data-danger={item.danger}
            disabled={item.disabled}
            onClick={() => {
              item.onSelect?.()
              onClose()
            }}
            role="menuitem"
          >
            {item.icon && <Icon name={item.icon} size={15} />}
            <span className="ctx-label">{item.label}</span>
            {item.hint && <span className="ctx-hint">{item.hint}</span>}
          </button>
        )
      })}
    </motion.div>,
    document.body,
  )
}
