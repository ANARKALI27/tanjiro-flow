import { create } from 'zustand'

export type Tone = 'info' | 'success' | 'error' | 'progress'

export interface ToastAction {
  label: string
  run: () => void
}

export interface Toast {
  id: string
  tone: Tone
  title: string
  body?: string
  /** 0..1 — renders a bar instead of an icon. */
  progress?: number
  actions?: ToastAction[]
  /** ms; omit for a notification that stays until dismissed. */
  timeout?: number
}

export interface NotificationState {
  toasts: Toast[]
  push: (t: Omit<Toast, 'id'>) => string
  update: (id: string, patch: Partial<Toast>) => void
  dismiss: (id: string) => void
  clear: () => void
}

let counter = 0

export const useNotifications = create<NotificationState>()((set) => ({
  toasts: [],
  push: (t) => {
    const id = `t${++counter}`
    const toast: Toast = { id, timeout: t.tone === 'error' ? undefined : 4200, ...t }
    set((s) => ({ toasts: [...s.toasts, toast] }))
    if (toast.timeout) {
      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }))
      }, toast.timeout)
    }
    return id
  },
  update: (id, patch) =>
    set((s) => ({ toasts: s.toasts.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}))

/** Convenience wrappers so call sites stay short. */
export const notify = {
  info: (title: string, body?: string) => useNotifications.getState().push({ tone: 'info', title, body }),
  success: (title: string, body?: string) =>
    useNotifications.getState().push({ tone: 'success', title, body }),
  error: (title: string, body?: string, actions?: ToastAction[]) =>
    useNotifications.getState().push({ tone: 'error', title, body, actions }),
}
