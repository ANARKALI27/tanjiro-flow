/** Mirrors `filesystem::FileKind` in the Rust backend. */
export type FileKind =
  | 'folder'
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'pdf'
  | 'text'
  | 'code'
  | 'archive'
  | 'application'
  | 'font'
  | 'disk'
  | 'shortcut'
  | 'other'

/** Mirrors `filesystem::FileEntry`. */
export interface FileEntry {
  name: string
  path: string
  parent: string | null
  isDir: boolean
  isSymlink: boolean
  size: number
  modified: number | null
  created: number | null
  accessed: number | null
  extension: string
  kind: FileKind
  hidden: boolean
  system: boolean
  readonly: boolean
}

export interface DirListing {
  path: string
  entries: FileEntry[]
  /** Items in the folder we could not read at all. Surfaced, never hidden. */
  unreadable: number
}

export interface FolderStats {
  totalSize: number
  files: number
  folders: number
  truncated: boolean
}

export type DriveType = 'fixed' | 'removable' | 'network' | 'optical' | 'ramDisk' | 'unknown'

export interface DriveInfo {
  letter: string
  path: string
  label: string
  driveType: DriveType
  filesystem: string
  totalBytes: number
  freeBytes: number
  usedBytes: number
  ready: boolean
}

export interface Place {
  id: string
  label: string
  path: string
}

export type ConflictPolicy = 'skip' | 'overwrite' | 'rename' | 'fail'

export interface OpOutcome {
  succeeded: string[]
  skipped: string[]
  /** [path, message] */
  failed: [string, string][]
}

export type PreviewStrategy = 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'archive' | 'none'

export interface PreviewPlan {
  strategy: PreviewStrategy
  note: string | null
}

export interface ArchiveEntry {
  name: string
  size: number
  compressed: number
  isDir: boolean
}

export interface ArchiveResult {
  path: string
  entries: number
  bytes: number
}

export interface AppInfo {
  name: string
  version: string
  platform: string
  hostname: string
}

export type SearchCategory =
  | 'recent'
  | 'large'
  | 'images'
  | 'videos'
  | 'audio'
  | 'documents'
  | 'applications'

export interface SearchOptions {
  query: string
  roots: string[]
  limit?: number
  maxDepth?: number
  kinds?: FileKind[]
  minSize?: number
  includeHidden?: boolean
}

/** The shape every backend error arrives in. */
export interface FlowError {
  kind:
    | 'AccessDenied'
    | 'NotFound'
    | 'InUse'
    | 'AlreadyExists'
    | 'Unsupported'
    | 'Io'
    | 'Other'
  message: string
}

export type ViewMode = 'grid' | 'list' | 'details' | 'gallery'
export type SortKey = 'name' | 'size' | 'modified' | 'kind'
export type SortDir = 'asc' | 'desc'

// ---------------------------------------------------------------------------
// Nearby Devices + Sharing
// ---------------------------------------------------------------------------

export interface DeviceIdentity {
  id: string
  name: string
}

export interface DeviceInfo {
  id: string
  name: string
  host: string
  port: number
  addresses: string[]
}

export interface FileHeader {
  name: string
  size: number
}

export interface IncomingOfferPayload {
  transferId: string
  fromName: string
  files: FileHeader[]
}

export interface ShareProgressEvent {
  transferId: string
  direction: 'send' | 'receive'
  done: number
  total: number
  currentFile: string
}

export interface ShareCompleteEvent {
  transferId: string
  ok: boolean
  error: string | null
  direction: 'send' | 'receive'
}

export interface CopyProgressEvent {
  opId: string
  destDir: string
  currentFile: string
  filesDone: number
  filesTotal: number
  bytesDone: number
  bytesTotal: number
}

export interface ReceivedItem {
  name: string
  path: string
  size: number
  fromName: string
  receivedAt: number
}

// ---------------------------------------------------------------------------
// Converter
// ---------------------------------------------------------------------------

export interface ConvertOutcome {
  converted: string[]
  failed: [string, string][]
}
