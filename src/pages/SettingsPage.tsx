import { useRef } from 'react'
import { Icon } from '../lib/icons'
import { useNav } from '../stores/navigation'
import {
  useSettings,
  withVideoDefaults,
  type AnimationLevel,
  type BackgroundType,
  type OverlayEffect,
  type PanelToggles,
  type SectionKey,
  type ThemeBase,
} from '../stores/settings'
import { ACCENTS, BUILTIN_THEMES, THEME_BASES, exportTheme, importTheme } from '../themes/presets'
import { Field, Segmented, Slider, Switch } from '../components/Primitives'
import { dialogs } from '../stores/dialogs'
import { notify } from '../stores/notifications'
import { save, open as openFileDialog } from '@tauri-apps/plugin-dialog'
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs'

const SECTION_LABELS: { key: SectionKey; label: string }[] = [
  { key: 'home', label: 'Home' },
  { key: 'quickAccess', label: 'Quick Access' },
  { key: 'files', label: 'Files' },
  { key: 'recent', label: 'Recent' },
  { key: 'starred', label: 'Starred' },
  { key: 'shared', label: 'Shared With Me' },
  { key: 'downloads', label: 'Downloads' },
  { key: 'torrents', label: 'Torrents' },
  { key: 'devices', label: 'Devices' },
  { key: 'network', label: 'Network' },
  { key: 'trash', label: 'Trash' },
  { key: 'drives', label: 'Drives' },
  { key: 'workspaces', label: 'Workspaces' },
]

const PANEL_LABELS: { key: keyof PanelToggles; label: string; help: string }[] = [
  { key: 'preview', label: 'Preview panel', help: 'Show the file preview panel while browsing.' },
  { key: 'quickActions', label: 'Quick actions', help: 'Show contextual actions for the current selection.' },
  { key: 'storage', label: 'Storage panel', help: 'Show the storage breakdown card on Home.' },
  { key: 'workspaces', label: 'Workspaces panel', help: 'Show Workspaces in the sidebar.' },
  { key: 'transfers', label: 'Transfer panel', help: 'Show active transfers when downloads or shares are running.' },
]

const ANIMATION_OPTIONS: { value: AnimationLevel; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
]

const BG_OPTIONS: { value: BackgroundType; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'solid', label: 'Solid' },
  { value: 'gradient', label: 'Gradient' },
  { value: 'image', label: 'Image' },
  { value: 'video', label: 'Video' },
]

const OVERLAY_OPTIONS: { value: OverlayEffect; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'rain', label: 'Rain' },
  { value: 'snow', label: 'Snow' },
  { value: 'fire', label: 'Fire' },
  { value: 'droplets', label: 'Droplets' },
]

const GRADIENT_PRESETS = [
  'linear-gradient(140deg, rgba(124,92,255,0.35), rgba(255,92,168,0.22) 55%, rgba(61,139,255,0.3))',
  'linear-gradient(160deg, rgba(58,226,197,0.3), rgba(79,142,255,0.22))',
  'linear-gradient(160deg, rgba(255,107,107,0.28), rgba(255,182,72,0.2))',
]

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <h3 className="card-title" style={{ marginBottom: 2 }}>
        {title}
      </h3>
      <div style={{ marginTop: 10 }}>{children}</div>
    </div>
  )
}

export function SettingsPage() {
  const s = useSettings()
  const tab = useNav((n) => n.settingsTab)
  const setTab = useNav((n) => n.setSettingsTab)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const saveTheme = async () => {
    const name = await dialogs.prompt({
      title: 'Save theme',
      label: 'Theme name',
      initial: 'My Theme',
      confirmLabel: 'Save',
    })
    if (!name) return
    const theme = s.saveCurrentAsTheme(name.trim())
    notify.success(`Saved "${theme.name}"`)
  }

  const exportCurrentTheme = async () => {
    const active = [...BUILTIN_THEMES, ...s.themes].find((t) => t.id === s.activeThemeId) ?? {
      id: 'custom',
      name: 'Custom',
      builtin: false,
      base: s.base,
      accent: s.accent,
      radius: s.radius,
      blur: s.blur,
      background: s.background,
    }
    const json = exportTheme(active)
    try {
      const path = await save({
        defaultPath: `${active.name.replace(/[^\w\- ]/g, '')}.ana-theme`,
        filters: [{ name: 'ANA Theme', extensions: ['ana-theme'] }],
      })
      if (path) {
        await writeTextFile(path, json)
        notify.success('Theme exported')
      }
    } catch (e) {
      notify.error('Couldn’t export the theme', String(e))
    }
  }

  const importThemeFile = async () => {
    try {
      const path = await openFileDialog({
        filters: [{ name: 'ANA Theme', extensions: ['ana-theme', 'json'] }],
        multiple: false,
      })
      if (!path || Array.isArray(path)) return
      const raw = await readTextFile(path)
      const theme = importTheme(raw)
      s.addTheme(theme)
      s.applyTheme(theme)
      notify.success(`Imported "${theme.name}"`)
    } catch (e) {
      notify.error('Couldn’t import that theme', e instanceof Error ? e.message : String(e))
    }
  }

  const pickBackgroundImage = async () => {
    try {
      const path = await openFileDialog({
        filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }],
        multiple: false,
      })
      if (!path || Array.isArray(path)) return
      s.set('background', {
        ...withVideoDefaults(s.background),
        type: 'image',
        value: path,
        opacity: s.background.opacity || 0.35,
      })
    } catch (e) {
      notify.error('Couldn’t open that image', String(e))
    }
  }

  const pickBackgroundVideo = async () => {
    try {
      const path = await openFileDialog({
        filters: [{ name: 'Video', extensions: ['mp4', 'webm'] }],
        multiple: false,
      })
      if (!path || Array.isArray(path)) return
      s.set('background', {
        ...withVideoDefaults(s.background),
        type: 'video',
        value: path,
        opacity: s.background.opacity || 0.5,
      })
    } catch (e) {
      notify.error('Couldn’t open that video', String(e))
    }
  }

  const allThemes = [...BUILTIN_THEMES, ...s.themes]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* This page (unlike FileBrowser/CategoryPage) isn't wrapped in a
          `.stage-content` glass card — it sits directly over the ambient
          background, which can be a busy image or video. A text-shadow alone
          isn't enough once that background gets dark or high-contrast
          patches under light-theme (dark) text — the same problem the
          sidebar/topbar solve with a real glass panel behind their text.
          `.settings-header` gives this one the same treatment. */}
      <div className="settings-header" style={{ flexShrink: 0 }}>
        <div style={{ padding: '18px 20px 0', maxWidth: 760 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 3px', color: 'var(--text)' }}>Customize</h2>
          <p style={{ fontSize: 12.5, color: 'var(--text-dim)', margin: 0 }}>
            Make Tanjiro Flow feel like yours.
          </p>
        </div>

        <div className="seg-choice" style={{ alignSelf: 'flex-start', margin: '16px 0 0 20px' }}>
          {(['appearance', 'themes', 'layout', 'behavior'] as const).map((t) => (
            <button key={t} data-active={tab === t} onClick={() => setTab(t)}>
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="scroll-area" style={{ padding: '16px 20px 40px', maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 16 }}>

      {tab === 'appearance' && (
        <>
          <SectionCard title="Appearance">
            <div className="swatches" role="radiogroup" aria-label="Theme base">
              {THEME_BASES.map((b) => (
                <button
                  key={b.id}
                  onClick={() => s.set('base', b.id as ThemeBase)}
                  data-active={s.base === b.id}
                  className="btn btn-stack"
                  style={{
                    height: 64,
                    gap: 7,
                    minWidth: 92,
                    padding: '10px 8px',
                    ['--theme-swatch-base' as string]: b.swatch,
                    ['--theme-swatch-accent' as string]: b.accent,
                  }}
                >
                  <span className="theme-swatch" />
                  <span style={{ fontSize: 11 }}>{b.name}</span>
                </button>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Accent">
            <div className="swatches">
              {ACCENTS.map((c) => (
                <button
                  key={c}
                  className="swatch"
                  style={{ background: c }}
                  data-active={s.accent.toLowerCase() === c.toLowerCase()}
                  onClick={() => s.set('accent', c)}
                  aria-label={`Accent ${c}`}
                />
              ))}
              <input
                type="color"
                value={s.accent}
                onChange={(e) => s.set('accent', e.target.value)}
                style={{ width: 28, height: 28, border: 'none', background: 'none', cursor: 'pointer' }}
                aria-label="Custom accent color"
              />
            </div>
          </SectionCard>

          <SectionCard title="Background">
            <Field label="Type">
              <Segmented
                value={s.background.type}
                options={BG_OPTIONS}
                onChange={(v) =>
                  s.set('background', {
                    ...withVideoDefaults(s.background),
                    type: v,
                    opacity: s.background.opacity || (v === 'none' ? 0 : 0.35),
                  })
                }
              />
            </Field>
            {s.background.type === 'solid' && (
              <Field label="Color">
                <input
                  type="color"
                  value={s.background.value || '#101323'}
                  onChange={(e) => s.set('background', { ...s.background, value: e.target.value })}
                  style={{ width: 28, height: 28, border: 'none', background: 'none', cursor: 'pointer' }}
                />
              </Field>
            )}
            {s.background.type === 'gradient' && (
              <Field label="Preset">
                <div className="swatches">
                  {GRADIENT_PRESETS.map((g, i) => (
                    <button
                      key={i}
                      className="swatch"
                      style={{ background: g, borderRadius: 8 }}
                      data-active={s.background.value === g}
                      onClick={() => s.set('background', { ...s.background, value: g })}
                    />
                  ))}
                </div>
              </Field>
            )}
            {s.background.type === 'image' && (
              <Field label="Image" help={s.background.value || 'No image selected'}>
                <button className="btn btn-sm" onClick={pickBackgroundImage}>
                  Choose Image
                </button>
              </Field>
            )}
            {s.background.type === 'video' && (
              <>
                <Field label="Video" help={s.background.value || 'No video selected · MP4 or WebM'}>
                  <button className="btn btn-sm" onClick={pickBackgroundVideo}>
                    Choose Video
                  </button>
                </Field>
                <Field label="Brightness">
                  <Slider
                    value={withVideoDefaults(s.background).videoBrightness}
                    min={0.3}
                    max={1.6}
                    step={0.05}
                    onChange={(v) => s.set('background', { ...withVideoDefaults(s.background), videoBrightness: v })}
                    label="Video brightness"
                    format={(v) => `${Math.round(v * 100)}%`}
                  />
                </Field>
                <Field label="Blur">
                  <Slider
                    value={withVideoDefaults(s.background).videoBlur}
                    min={0}
                    max={16}
                    step={0.5}
                    onChange={(v) => s.set('background', { ...withVideoDefaults(s.background), videoBlur: v })}
                    label="Video blur"
                    format={(v) => `${v}px`}
                  />
                </Field>
                <Field label="Playback speed">
                  <Slider
                    value={withVideoDefaults(s.background).videoSpeed}
                    min={0.25}
                    max={2}
                    step={0.05}
                    onChange={(v) => s.set('background', { ...withVideoDefaults(s.background), videoSpeed: v })}
                    label="Video playback speed"
                    format={(v) => `${v.toFixed(2)}x`}
                  />
                </Field>
                <Field label="Muted" help="Kept on by default — most browsers block autoplay with sound anyway.">
                  <Switch
                    checked={withVideoDefaults(s.background).videoMuted}
                    onChange={(v) => s.set('background', { ...withVideoDefaults(s.background), videoMuted: v })}
                    label="Mute background video"
                  />
                </Field>
              </>
            )}
            {s.background.type !== 'none' && (
              <Field label="Opacity">
                <Slider
                  value={s.background.opacity}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(v) => s.set('background', { ...s.background, opacity: v })}
                  label="Background opacity"
                  format={(v) => `${Math.round(v * 100)}%`}
                />
              </Field>
            )}
            <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 10 }}>
              Video backgrounds play as a real muted, looping video layer — MP4 and WebM both work,
              since that's what the app's own WebView2 engine can decode natively. Heavier footage
              (4K, high bitrate) costs more battery and GPU than a static image, so prefer something
              modest for all-day use.
            </p>
          </SectionCard>

          <SectionCard title="Overlay Effects">
            <Field label="Effect" help="A decorative animated layer over the background — rain, snow, embers, or condensation.">
              <Segmented value={s.overlayEffect} options={OVERLAY_OPTIONS} onChange={(v) => s.set('overlayEffect', v)} />
            </Field>
            {s.overlayEffect !== 'none' && (
              <Field label="Intensity">
                <Slider
                  value={s.overlayIntensity}
                  min={0.2}
                  max={1.6}
                  step={0.1}
                  onChange={(v) => s.set('overlayIntensity', v)}
                  label="Overlay intensity"
                  format={(v) => `${Math.round(v * 100)}%`}
                />
              </Field>
            )}
            <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 10 }}>
              Drawn on a single canvas layer, so it costs very little — but it does follow the
              Animation intensity setting below and turns off with it.
            </p>
          </SectionCard>

          <SectionCard title="UI">
            <Field label="Corner radius">
              <Slider value={s.radius} min={0} max={28} onChange={(v) => s.set('radius', v)} label="Corner radius" format={(v) => `${v}px`} />
            </Field>
            <Field label="Blur">
              <Slider value={s.blur} min={0} max={40} onChange={(v) => s.set('blur', v)} label="Blur" format={(v) => `${v}px`} />
            </Field>
            <Field label="Sidebar width">
              <Slider value={s.sidebarWidth} min={200} max={320} step={4} onChange={(v) => s.set('sidebarWidth', v)} label="Sidebar width" format={(v) => `${v}px`} />
            </Field>
            <Field label="File card size">
              <Slider value={s.cardSize} min={84} max={180} step={4} onChange={(v) => s.set('cardSize', v)} label="File card size" format={(v) => `${v}px`} />
            </Field>
            <Field label="UI density">
              <Slider value={s.density} min={0.8} max={1.3} step={0.05} onChange={(v) => s.set('density', v)} label="UI density" format={(v) => v.toFixed(2)} />
            </Field>
            <Field label="Animation intensity">
              <Segmented value={s.animation} options={ANIMATION_OPTIONS} onChange={(v) => s.set('animation', v)} />
            </Field>
          </SectionCard>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost btn-sm" onClick={s.resetAppearance}>
              Reset to defaults
            </button>
          </div>
        </>
      )}

      {tab === 'themes' && (
        <SectionCard title="Themes">
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <button className="btn btn-primary btn-sm" onClick={saveTheme}>
              <Icon name="plus" size={14} />
              Save Current
            </button>
            <button className="btn btn-sm" onClick={exportCurrentTheme}>
              <Icon name="download" size={14} />
              Export .ana-theme
            </button>
            <button className="btn btn-sm" onClick={importThemeFile}>
              <Icon name="upload" size={14} />
              Import
            </button>
          </div>
          <div className="drive-grid">
            {allThemes.map((t) => (
              <button
                key={t.id}
                className="drive-card"
                data-ready="true"
                onClick={() => s.applyTheme(t)}
                style={{
                  borderColor: s.activeThemeId === t.id ? 'var(--accent)' : undefined,
                  boxShadow: s.activeThemeId === t.id ? 'var(--glow)' : undefined,
                }}
              >
                <div className="drive-head">
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: t.accent,
                      flex: 'none',
                    }}
                  />
                  <div>
                    <div className="drive-name">{t.name}</div>
                    <div className="drive-letter">{THEME_BASES.find((b) => b.id === t.base)?.name}</div>
                  </div>
                </div>
                {!t.builtin && (
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={(e) => {
                      e.stopPropagation()
                      s.removeTheme(t.id)
                    }}
                  >
                    <Icon name="trash" size={13} />
                    Remove
                  </button>
                )}
              </button>
            ))}
          </div>
        </SectionCard>
      )}

      {tab === 'layout' && (
        <>
          <SectionCard title="Panels">
            {PANEL_LABELS.map((p) => (
              <Field key={p.key} label={p.label} help={p.help}>
                <Switch checked={s.panels[p.key]} onChange={() => s.togglePanel(p.key)} label={p.label} />
              </Field>
            ))}
          </SectionCard>
          <SectionCard title="Sidebar sections">
            {SECTION_LABELS.map((sec) => (
              <Field key={sec.key} label={sec.label}>
                <Switch checked={s.sections[sec.key]} onChange={() => s.toggleSection(sec.key)} label={sec.label} />
              </Field>
            ))}
          </SectionCard>
        </>
      )}

      {tab === 'behavior' && (
        <SectionCard title="Behavior">
          <Field label="Show hidden items">
            <Switch checked={s.showHidden} onChange={(v) => s.set('showHidden', v)} label="Show hidden items" />
          </Field>
          <Field label="Confirm before deleting" help="Ask before moving items to the Recycle Bin.">
            <Switch checked={s.confirmDelete} onChange={(v) => s.set('confirmDelete', v)} label="Confirm before deleting" />
          </Field>
          <Field label="Use Recycle Bin" help="When off, Delete permanently removes files immediately.">
            <Switch checked={s.useRecycleBin} onChange={(v) => s.set('useRecycleBin', v)} label="Use Recycle Bin" />
          </Field>
          <Field label="Folders first" help="List folders before files when sorting.">
            <Switch checked={s.foldersFirst} onChange={(v) => s.set('foldersFirst', v)} label="Folders first" />
          </Field>
        </SectionCard>
      )}

      <input ref={fileInputRef} type="file" style={{ display: 'none' }} />
      </div>
    </div>
  )
}
