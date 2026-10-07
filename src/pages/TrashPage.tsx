import { NotImplemented } from '../components/Primitives'

export function TrashPage() {
  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ fontSize: 15, margin: 0 }}>Trash</h2>
      <NotImplemented
        title="A custom Trash view isn't connected yet"
        what="Deleting a file in Tanjiro Flow already sends it to the real Windows Recycle Bin — nothing is lost. What's missing is browsing and restoring those items from inside Tanjiro Flow itself."
        plan="Until this is wired up, use “Show in Explorer” or open the Recycle Bin directly on your desktop to review or restore deleted items."
      />
    </div>
  )
}
