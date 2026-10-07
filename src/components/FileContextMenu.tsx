import type { MenuEntry } from './ContextMenu'
import type { FileEntry } from '../lib/types'
import type { FileActions } from '../hooks/useFileActions'
import { useSettings } from '../stores/settings'

/** Mirrors the Rust converter registry's supported image formats. */
const IMAGE_CONVERT_TARGETS = ['png', 'jpg', 'bmp', 'gif', 'webp', 'tiff', 'ico'];

function normalizeExt(ext: string): string {
  const e = ext.toLowerCase();
  return e === 'jpeg' ? 'jpg' : e;
}

/** Builds the right-click menu contents for a selection. */
export function buildFileMenu(
  entries: FileEntry[],
  actions: FileActions,
  extra: { onPaste: () => void; canPaste: boolean; onShare: (e: FileEntry[]) => void },
): MenuEntry[] {
  const single = entries.length === 1 ? entries[0] : null;
  const isArchive = single?.extension === 'zip';
  const starred = useSettings.getState().starred;
  const toggleStar = useSettings.getState().toggleStar;

  const items: MenuEntry[] = [];

  if (entries.length === 0) {
    items.push(
      { id: 'new-folder', label: 'New folder', icon: 'folderPlus', hint: 'Ctrl+Shift+N', onSelect: () => actions.newFolder() },
      { id: 'new-file', label: 'New file', icon: 'file', onSelect: () => actions.newFile() },
      { id: 'sep-1', separator: true },
      { id: 'paste', label: 'Paste', icon: 'clipboard', hint: 'Ctrl+V', disabled: !extra.canPaste, onSelect: extra.onPaste },
    );
    return items;
  }

  if (single) {
    items.push({ id: 'open', label: single.isDir ? 'Open' : 'Open', icon: single.isDir ? 'folder' : 'externalLink', hint: 'Enter', onSelect: () => actions.open(single) });
    if (!single.isDir) {
      items.push({ id: 'open-with', label: 'Open with…', icon: 'more', onSelect: () => actions.openWith(single) });
    }
    items.push({ id: 'share', label: 'Share', icon: 'share', onSelect: () => extra.onShare(entries) });
    items.push({ id: 'sep-open', separator: true });
  }

  items.push(
    { id: 'copy', label: 'Copy', icon: 'copy', hint: 'Ctrl+C', onSelect: () => actions.copy(entries) },
    { id: 'cut', label: 'Cut', icon: 'scissors', hint: 'Ctrl+X', onSelect: () => actions.cut(entries) },
    { id: 'copy-path', label: 'Copy as path', icon: 'clipboard', onSelect: () => actions.copyPath(entries) },
  );

  if (extra.canPaste) {
    items.push({ id: 'paste', label: 'Paste', icon: 'clipboard', hint: 'Ctrl+V', onSelect: extra.onPaste });
  }

  if (single) {
    items.push({ id: 'rename', label: 'Rename', icon: 'pencil', hint: 'F2', onSelect: () => actions.rename(single) });
  }

  items.push({ id: 'sep-2', separator: true });

  items.push({
    id: 'compress',
    label: 'Compress',
    icon: 'archive',
    onSelect: () => actions.compress(entries),
  });

  if (isArchive && single) {
    items.push({
      id: 'extract',
      label: 'Extract',
      icon: 'convert',
      submenu: [
        { id: 'extract-here', label: 'Extract Here', onSelect: () => actions.extract(single, false) },
        { id: 'extract-folder', label: 'Extract to Folder', onSelect: () => actions.extract(single, true) },
      ],
    });
  }

  const allImages = entries.length > 0 && entries.every((e) => e.kind === 'image');
  const imageTargets = allImages ? IMAGE_CONVERT_TARGETS : [];
  if (imageTargets.length > 0) {
    const sourceExt = single ? normalizeExt(single.extension) : null;
    const targets = single ? imageTargets.filter((t) => t !== sourceExt) : imageTargets;
    if (targets.length > 0) {
      items.push({
        id: 'convert-image',
        label: 'Convert to',
        icon: 'convert',
        submenu: targets.map((t) => ({
          id: `convert-${t}`,
          label: t.toUpperCase(),
          onSelect: () => actions.convertTo(entries, t),
        })),
      });
    }
  }

  if (single) {
    items.push({
      id: 'star',
      label: starred.includes(single.path) ? 'Remove from Starred' : 'Add to Starred',
      icon: 'star',
      onSelect: () => toggleStar(single.path),
    });
  }

  items.push({ id: 'sep-3', separator: true });

  items.push({
    id: 'delete',
    label: 'Delete',
    icon: 'trash',
    hint: 'Delete',
    danger: true,
    onSelect: () => actions.remove(entries),
  });

  items.push({ id: 'sep-4', separator: true });

  items.push({
    id: 'properties',
    label: 'Properties',
    icon: 'info',
    hint: 'Alt+Enter',
    onSelect: () => actions.showProperties(entries),
  });

  if (single) {
    items.push({ id: 'reveal', label: 'Show in Explorer', icon: 'externalLink', onSelect: () => actions.reveal(single) });
  }

  return items;
}
