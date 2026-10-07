import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useDialogs } from '../stores/dialogs'
import { useMotionScale } from '../hooks/useMotionScale'

export function PromptDialog() {
  const pending = useDialogs((s) => s.pending)
  const close = useDialogs((s) => s.close)
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const scale = useMotionScale()

  const spec = pending?.kind === 'prompt' ? pending.spec : null

  useEffect(() => {
    if (!spec) return
    setValue(spec.initial ?? '')
    setError(null)
    requestAnimationFrame(() => {
      const el = inputRef.current
      if (!el) return
      el.focus()
      const end = spec.selectTo ?? el.value.length
      el.setSelectionRange(0, end)
    })
  }, [spec])

  const submit = () => {
    if (!spec) return
    const v = value.trim()
    const err = spec.validate?.(v) ?? null
    if (err) {
      setError(err)
      return
    }
    close(v)
  }

  return (
    <AnimatePresence>
      {spec && (
        <motion.div
          className="overlay"
          onClick={() => close(null)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 * scale }}
        >
          <motion.div
            className="dialog"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 4 }}
            transition={{ duration: 0.18 * scale, ease: [0.16, 1, 0.3, 1] }}
          >
            <h2>{spec.title}</h2>
            {spec.body && <p className="dialog-sub">{spec.body}</p>}
            <input
              ref={inputRef}
              className="input"
              value={value}
              onChange={(e) => {
                setValue(e.target.value)
                setError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit()
                if (e.key === 'Escape') close(null)
              }}
              aria-label={spec.label ?? spec.title}
            />
            {error && (
              <p style={{ color: 'var(--danger)', fontSize: 11.5, marginTop: 8 }}>{error}</p>
            )}
            <div className="dialog-actions">
              <button className="btn btn-ghost" onClick={() => close(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={submit}>
                {spec.confirmLabel ?? 'OK'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
