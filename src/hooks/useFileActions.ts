import { useCallback, useMemo } from 'react'
import { api } from '../lib/ipc'
import { basename, joinPath, parentOf, pluralize, splitName } from '../lib/format'
import type { FileEntry, FlowError, OpOutcome } from '../lib/types'
import { dialogs } from '../stores/dialogs'
import { notify, useNotifications } from '../stores/notifications'
import { useClipboard } from '../stores/clipboard'
import { useNav } from '../stores/navigation'
import { useSelection } from '../stores/selection'
import { useSettings } from '../stores/settings'

const INVALID = /[\\/:*?"<>|]/

function validateName(value: string): string | null {
  const v = value.trim()
  if (!v) return 'Enter a name.'
  if (INVALID.test(v)) return 'A name can’t contain \\ / : * ? " < > |'
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(v)) return 'That name is reserved by Windows.'
  if (v.endsWith('.') || v.endsWith(' ')) return 'A name can’t end with a space or a dot.'
  return null
}

/** Report an OpOutcome honestly: partial success is still partial. */
function reportOutcome(verb: string, outcome: OpOutcome) {
  const ok = outcome.succeeded.length
  const failed = outcome.failed.length
  const skipped = outcome.skipped.length

  if (failed === 0 && skipped === 0) {
    notify.success(`${verb} ${pluralize(ok, 'item')}`)
    return
  }
  if (ok === 0 && failed > 0) {
    const [path, message] = outcome.failed[0]
    notify.error(
      `Couldn’t ${verb.toLowerCase()} ${basename(path)}`,
      failed > 1 ? `${message} (and ${failed - 1} more failed)` : message,
    )
    return
  }
  const bits = [`${verb.toLowerCase()} ${ok}`]
  if (skipped) bits.push(`skipped ${skipped}`)
  if (failed) bits.push(`failed ${failed}`)
  notify.info(
    `Finished with issues`,
    `${bits.join(', ')}. ${failed ? outcome.failed[0][1] : ''}`.trim(),
  )
}

function reportError(e: unknown, fallback: string) {
  const err = e as FlowError
  notify.error(fallback, err?.message ?? String(e))
}

export function useFileActions(pane: 0 | 1 = 0) {
  const nav = useNav()
  const clipboard = useClipboard()
  const selection = useSelection()
  const useRecycleBin = useSettings((s) => s.useRecycleBin)
  const confirmDelete = useSettings((s) => s.confirmDelete)
  const push = useNotifications((s) => s.push)
  const dismiss = useNotifications((s) => s.dismiss)

  const currentPath = nav.panes[pane].path

  const open = useCallback(
    async (entry: FileEntry) => {
      if (entry.isDir) {
        nav.go(entry.path, pane)
        selection.clear(pane)
        return
      }
      try {
        await api.open(entry.path)
      } catch (e) {
        reportError(e, `Couldn’t open ${entry.name}`)
      }
    },
    [nav, pane, selection],
  )

  const openWith = useCallback(async (entry: FileEntry) => {
    try {
      await api.openWith(entry.path)
    } catch (e) {
      reportError(e, 'Couldn’t show the app chooser')
    }
  }, [])

  const reveal = useCallback(async (entry: FileEntry) => {
    try {
      await api.reveal(entry.path)
    } catch (e) {
      reportError(e, 'Couldn’t open Explorer')
    }
  }, [])

  const newFolder = useCallback(async () => {
    if (!currentPath) return
    const name = await dialogs.prompt({
      title: 'New folder',
      label: 'Folder name',
      initial: 'New folder',
      confirmLabel: 'Create',
      validate: validateName,
    })
    if (!name) return
    try {
      const entry = await api.createFolder(currentPath, name.trim())
      nav.reload()
      selection.select(pane, entry.path, entry)
    } catch (e) {
      reportError(e, 'Couldn’t create the folder')
    }
  }, [currentPath, nav, pane, selection])

  const newFile = useCallback(async () => {
    if (!currentPath) return
    const name = await dialogs.prompt({
      title: 'New file',
      label: 'File name',
      initial: 'New file.txt',
      confirmLabel: 'Create',
      validate: validateName,
    })
    if (!name) return
    try {
      const entry = await api.createFile(currentPath, name.trim())
      nav.reload()
      selection.select(pane, entry.path, entry)
    } catch (e) {
      reportError(e, 'Couldn’t create the file')
    }
  }, [currentPath, nav, pane, selection])

  const rename = useCallback(
    async (entry: FileEntry) => {
      const [stem] = splitName(entry.name)
      const next = await dialogs.prompt({
        title: 'Rename',
        label: 'New name',
        initial: entry.name,
        confirmLabel: 'Rename',
        // Preselect just the stem so the extension survives a careless type.
        selectTo: entry.isDir ? entry.name.length : stem.length,
        validate: validateName,
      })
      if (!next || next.trim() === entry.name) return
      try {
        const updated = await api.rename(entry.path, next.trim())
        nav.reload()
        selection.select(pane, updated.path, updated)
        notify.success(`Renamed to ${updated.name}`)
      } catch (e) {
        reportError(e, `Couldn’t rename ${entry.name}`)
      }
    },
    [nav, pane, selection],
  )

  const remove = useCallback(
    async (entries: FileEntry[], forcePermanent = false) => {
      if (!entries.length) return
      const permanent = forcePermanent || !useRecycleBin
      const label =
        entries.length === 1 ? `"${entries[0].name}"` : pluralize(entries.length, 'item')

      if (confirmDelete || permanent) {
        const result = await dialogs.confirm({
          title: permanent ? `Permanently delete ${label}?` : `Delete ${label}?`,
          body: permanent
            ? 'This cannot be undone — the items will not go to the Recycle Bin.'
            : 'The items will be moved to the Recycle Bin.',
          confirmLabel: permanent ? 'Delete permanently' : 'Move to Recycle Bin',
          danger: true,
          alternative: permanent ? undefined : 'Delete permanently',
        })
        if (result === 'cancel') return
        if (result === 'alternative') {
          await remove(entries, true)
          return
        }
      }

      try {
        const outcome = await api.remove(
          entries.map((e) => e.path),
          permanent,
        )
        selection.clear(pane)
        nav.reload()
        reportOutcome(permanent ? 'Deleted' : 'Moved to Recycle Bin', outcome)
      } catch (e) {
        reportError(e, 'Couldn’t delete')
      }
    },
    [confirmDelete, useRecycleBin, nav, pane, selection],
  )

  const copy = useCallback(
    (entries: FileEntry[]) => {
      if (!entries.length) return
      clipboard.copy(entries.map((e) => e.path))
      notify.info(`Copied ${pluralize(entries.length, 'item')}`)
    },
    [clipboard],
  )

  const cut = useCallback(
    (entries: FileEntry[]) => {
      if (!entries.length) return
      clipboard.cut(entries.map((e) => e.path))
      notify.info(`Cut ${pluralize(entries.length, 'item')}`)
    },
    [clipboard],
  )

  const paste = useCallback(async () => {
    const { mode, paths } = clipboard
    if (!mode || !paths.length || !currentPath) return

    // Pasting into the folder the items already live in would be a no-op for a
    // move and a duplicate for a copy; "rename" makes the copy case sensible.
    const sameFolder = paths.every((p) => parentOf(p) === currentPath)
    if (mode === 'cut' && sameFolder) {
      clipboard.clear()
      return
    }

    const id = push({
      tone: 'progress',
      title: mode === 'copy' ? 'Copying…' : 'Moving…',
      body: pluralize(paths.length, 'item'),
    })
    try {
      const outcome =
        mode === 'copy'
          ? await api.copy(paths, currentPath, 'rename')
          : await api.move(paths, currentPath, 'rename')
      dismiss(id)
      if (mode === 'cut') clipboard.clear()
      nav.reload()
      reportOutcome(mode === 'copy' ? 'Copied' : 'Moved', outcome)
    } catch (e) {
      dismiss(id)
      reportError(e, mode === 'copy' ? 'Couldn’t copy' : 'Couldn’t move')
    }
  }, [clipboard, currentPath, nav, push, dismiss])

  const compress = useCallback(
    async (entries: FileEntry[]) => {
      if (!entries.length || !currentPath) return
      const suggested =
        entries.length === 1 ? `${splitName(entries[0].name)[0]}.zip` : 'Archive.zip'
      const name = await dialogs.prompt({
        title: 'Compress to ZIP',
        label: 'Archive name',
        initial: suggested,
        confirmLabel: 'Compress',
        selectTo: suggested.length - 4,
        validate: validateName,
      })
      if (!name) return
      const dest = joinPath(currentPath, name.endsWith('.zip') ? name : `${name}.zip`)
      const id = push({ tone: 'progress', title: 'Compressing…', body: name })
      try {
        const result = await api.compress(
          entries.map((e) => e.path),
          dest,
        )
        dismiss(id)
        nav.reload()
        notify.success('Archive created', `${basename(result.path)} — ${result.entries} files`)
      } catch (e) {
        dismiss(id)
        reportError(e, 'Couldn’t create the archive')
      }
    },
    [currentPath, nav, push, dismiss],
  )

  const extract = useCallback(
    async (entry: FileEntry, toSubfolder: boolean) => {
      const parent = parentOf(entry.path)
      if (!parent) return
      const dest = toSubfolder ? joinPath(parent, splitName(entry.name)[0]) : parent
      const id = push({ tone: 'progress', title: 'Extracting…', body: entry.name })
      try {
        const result = await api.extract(entry.path, dest)
        dismiss(id)
        nav.reload()
        notify.success('Extracted', `${result.entries} files to ${basename(dest)}`)
      } catch (e) {
        dismiss(id)
        reportError(e, `Couldn’t extract ${entry.name}`)
      }
    },
    [nav, push, dismiss],
  )

  const showProperties = useCallback((entries: FileEntry[]) => {
    if (entries.length) void dialogs.properties(entries)
  }, [])

  const convertTo = useCallback(
    async (entries: FileEntry[], targetFormat: string) => {
      if (!entries.length) return
      const id = push({
        tone: 'progress',
        title: `Converting to .${targetFormat}\u2026`,
        body: pluralize(entries.length, 'file'),
      })
      try {
        const outcome = await api.converterConvert(
          entries.map((e) => e.path),
          targetFormat,
        )
        dismiss(id)
        nav.reload()
        if (outcome.failed.length === 0) {
          notify.success(
            `Converted ${pluralize(outcome.converted.length, 'file')}`,
            outcome.converted.length === 1 ? basename(outcome.converted[0]) : undefined,
          )
        } else if (outcome.converted.length === 0) {
          notify.error('Conversion failed', outcome.failed[0][1])
        } else {
          notify.info(
            'Finished with issues',
            `Converted ${outcome.converted.length}, failed ${outcome.failed.length}: ${outcome.failed[0][1]}`,
          )
        }
      } catch (e) {
        dismiss(id)
        reportError(e, 'Couldn\u2019t convert')
      }
    },
    [nav, push, dismiss],
  )

  return useMemo(
    () => ({
      open,
      openWith,
      reveal,
      newFolder,
      newFile,
      rename,
      remove,
      copy,
      cut,
      paste,
      compress,
      extract,
      showProperties,
      convertTo,
      canPaste: Boolean(clipboard.mode && clipboard.paths.length && currentPath),
    }),
    [
      open,
      openWith,
      reveal,
      newFolder,
      newFile,
      rename,
      remove,
      copy,
      cut,
      paste,
      compress,
      extract,
      showProperties,
      convertTo,
      clipboard.mode,
      clipboard.paths.length,
      currentPath,
    ],
  )
}

export type FileActions = ReturnType<typeof useFileActions>
