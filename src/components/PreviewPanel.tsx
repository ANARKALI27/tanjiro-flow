import { useEffect, useState } from 'react'
import { api, assetUrl } from '../lib/ipc'
import { formatBytes, formatDate } from '../lib/format'
import { KindIcon } from '../lib/icons'
import { Spinner } from './Primitives'
import type { FileEntry, FlowError, PreviewPlan } from '../lib/types'

function PreviewBody({ entry, plan }: { entry: FileEntry; plan: PreviewPlan }) {
  const [text, setText] = useState<string | null>(null)
  const [textError, setTextError] = useState<string | null>(null)

  useEffect(() => {
    if (plan.strategy !== 'text') return
    let cancelled = false
    api
      .readTextHead(entry.path, 64 * 1024)
      .then((t) => !cancelled && setText(t))
      .catch((e: FlowError) => !cancelled && setTextError(e.message))
    return () => {
      cancelled = true
    }
  }, [entry.path, plan.strategy])

  switch (plan.strategy) {
    case 'image':
      return (
        <div className="preview-stage">
          <img src={assetUrl(entry.path)} alt={entry.name} />
        </div>
      )
    case 'video':
      return (
        <div className="preview-stage">
          <video src={assetUrl(entry.path)} controls preload="metadata" />
        </div>
      )
    case 'audio':
      return (
        <div className="preview-stage" style={{ padding: 16 }}>
          <audio src={assetUrl(entry.path)} controls style={{ width: '100%' }} />
        </div>
      )
    case 'pdf':
      return (
        <div className="preview-stage" style={{ minHeight: 280 }}>
          <embed src={assetUrl(entry.path)} type="application/pdf" width="100%" height="280" />
        </div>
      )
    case 'text':
      return textError ? (
        <div className="preview-stage" style={{ padding: 14, color: 'var(--text-faint)', fontSize: 12 }}>
          {textError}
        </div>
      ) : text === null ? (
        <div className="preview-stage">
          <Spinner />
        </div>
      ) : (
        <pre className="preview-text">{text}</pre>
      )
    default:
      return (
        <div className="preview-stage" style={{ flexDirection: 'column', gap: 8 }}>
          <KindIcon kind={entry.kind} size={38} />
        </div>
      )
  }
}

/** Right-hand preview panel. Degrades to the type icon for anything unsupported. */
export function PreviewPanel({ entry }: { entry: FileEntry | null }) {
  const [plan, setPlan] = useState<PreviewPlan | null>(null)

  useEffect(() => {
    if (!entry || entry.isDir) {
      setPlan(null)
      return
    }
    let cancelled = false
    api
      .previewPlan(entry.path)
      .then((p) => !cancelled && setPlan(p))
      .catch(() => !cancelled && setPlan({ strategy: 'none', note: null }))
    return () => {
      cancelled = true
    }
  }, [entry?.path])

  if (!entry) {
    return (
      <div className="panel-card">
        <div className="panel-head">Preview</div>
        <p style={{ fontSize: 12, color: 'var(--text-faint)' }}>Select a file to preview it.</p>
      </div>
    )
  }

  return (
    <div className="panel-card">
      <div className="panel-head">Preview</div>
      {entry.isDir ? (
        <div className="preview-stage" style={{ flexDirection: 'column', gap: 8 }}>
          <KindIcon kind="folder" size={38} />
        </div>
      ) : plan ? (
        <PreviewBody entry={entry} plan={plan} />
      ) : (
        <div className="preview-stage">
          <Spinner />
        </div>
      )}
      {plan?.note && (
        <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 8, lineHeight: 1.5 }}>
          {plan.note}
        </p>
      )}
      <dl className="kv" style={{ marginTop: 12 }}>
        <dt>Name</dt>
        <dd style={{ userSelect: 'text' }}>{entry.name}</dd>
        {!entry.isDir && (
          <>
            <dt>Size</dt>
            <dd>{formatBytes(entry.size)}</dd>
          </>
        )}
        <dt>Modified</dt>
        <dd>{formatDate(entry.modified)}</dd>
      </dl>
    </div>
  )
}
