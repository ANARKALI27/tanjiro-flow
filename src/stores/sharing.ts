import { create } from 'zustand'
import { listen } from '@tauri-apps/api/event'
import { api } from '../lib/ipc'
import { basename } from '../lib/format'
import type {
  DeviceIdentity,
  DeviceInfo,
  IncomingOfferPayload,
  ReceivedItem,
  ShareCompleteEvent,
  ShareProgressEvent,
} from '../lib/types'
import { notify, useNotifications } from './notifications'

export interface ActiveTransfer {
  transferId: string
  direction: 'send' | 'receive'
  currentFile: string
  done: number
  total: number
}

interface SharingState {
  self: DeviceIdentity | null
  devices: DeviceInfo[]
  received: ReceivedItem[]
  transfers: Record<string, ActiveTransfer>
  started: boolean
  init: () => void
}

export const useSharing = create<SharingState>()((set, get) => ({
  self: null,
  devices: [],
  received: [],
  transfers: {},
  started: false,

  init: () => {
    if (get().started) return
    set({ started: true })

    void api.deviceSelfInfo().then((self) => set({ self })).catch(() => {})
    void api.sharedReceivedList().then((received) => set({ received })).catch(() => {})
    void api.devicesList().then((devices) => set({ devices })).catch(() => {})

    void listen<DeviceInfo[]>('devices://changed', (e) => set({ devices: e.payload }))

    void listen<ReceivedItem[]>('shared://received', (e) => {
      set({ received: e.payload })
      const latest = e.payload[0]
      if (latest) {
        notify.success(`Received ${latest.name}`, `From ${latest.fromName}`)
      }
    })

    void listen<IncomingOfferPayload>('share://incoming-offer', (e) => {
      const { transferId, fromName, files } = e.payload
      const fileList = files.length === 1 ? files[0].name : `${files.length} files`
      const push = useNotifications.getState().push
      const dismiss = useNotifications.getState().dismiss
      const id = push({
        tone: 'info',
        title: `${fromName} wants to send you ${fileList}`,
        timeout: undefined, // stays until the user responds
        actions: [
          {
            label: 'Accept',
            run: () => {
              dismiss(id)
              void api.shareRespond(transferId, true).catch(() => {})
            },
          },
          {
            label: 'Decline',
            run: () => {
              dismiss(id)
              void api.shareRespond(transferId, false).catch(() => {})
            },
          },
        ],
      })
    })

    void listen<ShareProgressEvent>('share://progress', (e) => {
      const p = e.payload
      set((s) => ({
        transfers: {
          ...s.transfers,
          [p.transferId]: {
            transferId: p.transferId,
            direction: p.direction,
            currentFile: p.currentFile,
            done: p.done,
            total: p.total,
          },
        },
      }))
    })

    void listen<ShareCompleteEvent>('share://complete', (e) => {
      const c = e.payload
      set((s) => {
        const next = { ...s.transfers }
        delete next[c.transferId]
        return { transfers: next }
      })
      if (c.direction === 'send') {
        if (c.ok) notify.success('Files sent')
        else if (c.error && c.error !== 'Declined.') notify.error('Send failed', c.error)
      }
    })
  },
}))

/** Kicks off a send and gives the caller a friendly toast immediately —
 * progress/completion arrive later via the events wired up in init(). */
export async function sendFilesToDevice(device: DeviceInfo, paths: string[]) {
  try {
    await api.shareSendFiles(device.id, paths)
    const label = paths.length === 1 ? basename(paths[0]) : `${paths.length} items`
    notify.info(`Sending ${label} to ${device.name}…`)
  } catch (e) {
    const err = e as { message?: string }
    notify.error(`Couldn’t send to ${device.name}`, err?.message ?? String(e))
  }
}
