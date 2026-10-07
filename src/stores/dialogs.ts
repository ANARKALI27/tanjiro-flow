import { create } from 'zustand'
import type { FileEntry } from '../lib/types'

export interface ConfirmSpec {
  title: string
  body?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  /** Optional extra choice, e.g. "Delete permanently". */
  alternative?: string
}

export interface PromptSpec {
  title: string
  body?: string
  label?: string
  initial?: string
  confirmLabel?: string
  /** Characters [0, n) get preselected — used to select a filename's stem. */
  selectTo?: number
  validate?: (value: string) => string | null
}

/** `alternative` means the user picked the extra button, not the primary one. */
export type ConfirmResult = 'confirm' | 'alternative' | 'cancel'

type Pending =
  | { kind: 'confirm'; spec: ConfirmSpec; resolve: (r: ConfirmResult) => void }
  | { kind: 'prompt'; spec: PromptSpec; resolve: (r: string | null) => void }
  | { kind: 'properties'; entries: FileEntry[]; resolve: () => void }

export interface DialogState {
  pending: Pending | null
  close: (value?: unknown) => void
  _open: (p: Pending) => void
}

export const useDialogs = create<DialogState>()((set, get) => ({
  pending: null,
  _open: (pending) => set({ pending }),
  close: (value) => {
    const p = get().pending
    set({ pending: null })
    if (!p) return
    if (p.kind === 'confirm') p.resolve((value as ConfirmResult) ?? 'cancel')
    else if (p.kind === 'prompt') p.resolve((value as string | null) ?? null)
    else p.resolve()
  },
}))

/**
 * Promise-shaped dialogs. Lets an action read as a sequence —
 * `if (await dialogs.confirm(...) !== 'confirm') return` — instead of a
 * callback chain threaded through component props.
 */
export const dialogs = {
  confirm(spec: ConfirmSpec): Promise<ConfirmResult> {
    return new Promise((resolve) => useDialogs.getState()._open({ kind: 'confirm', spec, resolve }))
  },
  prompt(spec: PromptSpec): Promise<string | null> {
    return new Promise((resolve) => useDialogs.getState()._open({ kind: 'prompt', spec, resolve }))
  },
  properties(entries: FileEntry[]): Promise<void> {
    return new Promise((resolve) =>
      useDialogs.getState()._open({ kind: 'properties', entries, resolve }),
    )
  },
}
