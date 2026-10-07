import { invoke } from '@tauri-apps/api/core'
import { convertFileSrc } from '@tauri-apps/api/core'
import type {
  AppInfo,
  ArchiveEntry,
  ArchiveResult,
  ConflictPolicy,
  ConvertOutcome,
  DeviceIdentity,
  DeviceInfo,
  DirListing,
  DriveInfo,
  FileEntry,
  FlowError,
  FolderStats,
  OpOutcome,
  Place,
  PreviewPlan,
  ReceivedItem,
  SearchCategory,
  SearchOptions,
} from './types'

/**
 * Normalizes anything thrown across the IPC boundary into a FlowError, so no
 * call site ever has to deal with an unknown. A backend that returns a proper
 * `{ kind, message }` passes straight through; anything else becomes `Other`.
 */
export function asFlowError(e: unknown): FlowError {
  if (e && typeof e === 'object' && 'kind' in e && 'message' in e) {
    return e as FlowError
  }
  if (e instanceof Error) return { kind: 'Other', message: e.message }
  return { kind: 'Other', message: String(e) }
}

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args)
  } catch (e) {
    throw asFlowError(e)
  }
}

/** Turn a filesystem path into something an <img>/<video> can load. */
export function assetUrl(path: string): string {
  return convertFileSrc(path)
}

export const api = {
  // --- browsing ---
  listDir: (path: string, showHidden: boolean) =>
    call<DirListing>('fs_list_dir', { path, showHidden }),
  entry: (path: string) => call<FileEntry>('fs_entry', { path }),
  folderStats: (path: string, maxEntries?: number) =>
    call<FolderStats>('fs_folder_stats', { path, maxEntries }),
  readTextHead: (path: string, maxBytes?: number) =>
    call<string>('fs_read_text_head', { path, maxBytes }),

  // --- mutations ---
  createFolder: (parent: string, name: string) =>
    call<FileEntry>('fs_create_folder', { parent, name }),
  createFile: (parent: string, name: string) =>
    call<FileEntry>('fs_create_file', { parent, name }),
  rename: (path: string, newName: string) =>
    call<FileEntry>('fs_rename', { path, newName }),
  remove: (paths: string[], permanent: boolean) =>
    call<OpOutcome>('fs_delete', { paths, permanent }),
  copy: (sources: string[], destDir: string, policy: ConflictPolicy) =>
    call<OpOutcome>('fs_copy', { sources, destDir, policy }),
  move: (sources: string[], destDir: string, policy: ConflictPolicy) =>
    call<OpOutcome>('fs_move', { sources, destDir, policy }),

  // --- places / drives ---
  places: () => call<Place[]>('fs_places'),
  drives: () => call<DriveInfo[]>('drives_list'),

  // --- search ---
  search: (options: SearchOptions) => call<FileEntry[]>('search_files', { options }),
  category: (category: SearchCategory, limit?: number) =>
    call<FileEntry[]>('search_category', { category, limit }),

  // --- shell ---
  open: (path: string) => call<void>('shell_open', { path }),
  openWith: (path: string) => call<void>('shell_open_with', { path }),
  reveal: (path: string) => call<void>('shell_reveal', { path }),

  // --- archives ---
  compress: (sources: string[], dest: string) =>
    call<ArchiveResult>('archive_compress', { sources, dest }),
  extract: (archive: string, destDir: string) =>
    call<ArchiveResult>('archive_extract', { archive, destDir }),
  listArchive: (archive: string) => call<ArchiveEntry[]>('archive_list', { archive }),

  // --- misc ---
  previewPlan: (path: string) => call<PreviewPlan>('preview_plan', { path }),
  fileIcon: (path: string) => call<string>('fs_file_icon', { path }),
  appInfo: () => call<AppInfo>('app_info'),

  // --- default file manager ---
  defaultManagerStatus: () => call<boolean>('default_manager_status'),
  defaultManagerSet: (enable: boolean) => call<void>('default_manager_set', { enable }),
  startupPath: () => call<string | null>('startup_path'),

  // --- nearby devices + sharing ---
  deviceSelfInfo: () => call<DeviceIdentity>('devices_self_info'),
  deviceSetName: (name: string) => call<DeviceIdentity>('devices_set_name', { name }),
  devicesList: () => call<DeviceInfo[]>('devices_list'),
  shareSendFiles: (deviceId: string, paths: string[]) =>
    call<string>('share_send_files', { deviceId, paths }),
  shareRespond: (transferId: string, accept: boolean) =>
    call<void>('share_respond', { transferId, accept }),
  sharedReceivedList: () => call<ReceivedItem[]>('shared_received_list'),
  sharedOpenFolder: () => call<void>('shared_open_folder'),

  // --- converter ---
  converterConvert: (paths: string[], targetFormat: string, destDir?: string) =>
    call<ConvertOutcome>('converter_convert', { paths, targetFormat, destDir }),
}
