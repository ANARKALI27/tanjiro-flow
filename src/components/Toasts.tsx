import { AnimatePresence, motion } from 'framer-motion'
import { Icon } from '../lib/icons'
import { useNotifications } from '../stores/notifications'
import { useMotionScale } from '../hooks/useMotionScale'

const TONE_ICON: Record<string, string> = {
  error: 'alert',
  success: 'checkCircle',
  info: 'info',
  progress: 'refresh',
}

export function Toasts() {
  const toasts = useNotifications((s) => s.toasts)
  const dismiss = useNotifications((s) => s.dismiss)
  const scale = useMotionScale()

  if (toasts.length === 0) return null

  return (
    <div className="toasts">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            className="toast"
            data-tone={t.tone}
            role="status"
            initial={{ opacity: 0, x: 24, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 24, scale: 0.98 }}
            transition={{ duration: 0.2 * scale, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="toast-icon">
              <Icon name={TONE_ICON[t.tone] ?? 'info'} size={17} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="toast-title">{t.title}</div>
              {t.body && <div className="toast-body">{t.body}</div>}
              {typeof t.progress === 'number' && (
                <div className="meter" style={{ marginTop: 8 }}>
                  <div className="meter-fill" style={{ width: `${Math.round(t.progress * 100)}%` }} />
                </div>
              )}
              {t.actions && (
                <div className="toast-actions">
                  {t.actions.map((a) => (
                    <button key={a.label} className="btn btn-sm btn-ghost" onClick={a.run}>
                      {a.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className="icon-btn" style={{ width: 22, height: 22 }} onClick={() => dismiss(t.id)}>
              <Icon name="x" size={12} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
