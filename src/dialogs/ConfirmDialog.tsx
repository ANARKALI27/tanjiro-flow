import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useDialogs } from '../stores/dialogs'
import { useMotionScale } from '../hooks/useMotionScale'

export function ConfirmDialog() {
  const pending = useDialogs((s) => s.pending)
  const close = useDialogs((s) => s.close)
  const btnRef = useRef<HTMLButtonElement>(null)
  const scale = useMotionScale()

  const spec = pending?.kind === 'confirm' ? pending.spec : null

  useEffect(() => {
    if (spec) requestAnimationFrame(() => btnRef.current?.focus())
  }, [spec])

  return (
    <AnimatePresence>
      {spec && (
        <motion.div
          className="overlay"
          onClick={() => close('cancel')}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 * scale }}
        >
          <motion.div
            className="dialog"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') close('cancel')
            }}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 4 }}
            transition={{ duration: 0.18 * scale, ease: [0.16, 1, 0.3, 1] }}
          >
            <h2>{spec.title}</h2>
            {spec.body && <p className="dialog-sub">{spec.body}</p>}
            <div className="dialog-actions">
              {spec.alternative && (
                <button className="btn btn-ghost" style={{ marginRight: 'auto' }} onClick={() => close('alternative')}>
                  {spec.alternative}
                </button>
              )}
              <button className="btn btn-ghost" onClick={() => close('cancel')}>
                {spec.cancelLabel ?? 'Cancel'}
              </button>
              <button
                ref={btnRef}
                className={spec.danger ? 'btn btn-danger' : 'btn btn-primary'}
                onClick={() => close('confirm')}
              >
                {spec.confirmLabel ?? 'Confirm'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
