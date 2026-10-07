import type { ReactNode } from 'react'
import { Icon } from '../lib/icons'

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="switch"
      data-on={checked}
      onClick={() => onChange(!checked)}
    />
  )
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
  format,
}: {
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  label: string
  format?: (v: number) => string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <input
        className="range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span
        style={{
          fontSize: 11.5,
          color: 'var(--text-faint)',
          fontVariantNumeric: 'tabular-nums',
          minWidth: 38,
          textAlign: 'right',
        }}
      >
        {format ? format(value) : value}
      </span>
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="seg-choice" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          data-active={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Field({
  label,
  help,
  children,
}: {
  label: string
  help?: string
  children: ReactNode
}) {
  return (
    <div className="field">
      <div>
        <div className="field-label">{label}</div>
        {help ? <div className="field-help">{help}</div> : null}
      </div>
      <div style={{ flex: 'none' }}>{children}</div>
    </div>
  )
}

export function Empty({
  icon = 'folder',
  title,
  body,
  action,
}: {
  icon?: string
  title: string
  body?: string
  action?: ReactNode
}) {
  return (
    <div className="empty">
      <Icon name={icon} size={30} strokeWidth={1.3} />
      <div className="empty-title">{title}</div>
      {body ? <div className="empty-body">{body}</div> : null}
      {action}
    </div>
  )
}

export function Spinner() {
  return <span className="spinner" role="status" aria-label="Loading" />
}

export function Meter({ ratio }: { ratio: number }) {
  const pct = Math.max(0, Math.min(1, ratio)) * 100
  const level = pct > 92 ? 'critical' : pct > 80 ? 'warn' : 'ok'
  return (
    <div className="meter">
      <div className="meter-fill" data-level={level} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Badge({ children, tone }: { children: ReactNode; tone?: 'muted' }) {
  return (
    <span className="badge" data-tone={tone}>
      {children}
    </span>
  )
}

/**
 * A short, honest notice for a section whose backend isn't implemented yet.
 * Used instead of fake data, so the UI never implies a capability that
 * doesn't exist.
 */
export function NotImplemented({
  title,
  what,
  plan,
}: {
  title: string
  what: string
  plan: string
}) {
  return (
    <div className="card" style={{ maxWidth: 620 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 9 }}>
        <Badge tone="muted">Not implemented yet</Badge>
      </div>
      <h3 className="card-title" style={{ fontSize: 14 }}>
        {title}
      </h3>
      <p className="card-sub" style={{ marginTop: 6, lineHeight: 1.6 }}>
        {what}
      </p>
      <p className="card-sub" style={{ marginTop: 10, lineHeight: 1.6, color: 'var(--text-faint)' }}>
        {plan}
      </p>
    </div>
  )
}
