import { useEffect, useRef } from 'react'
import { useSettings, withVideoDefaults } from '../stores/settings'
import { assetUrl } from '../lib/ipc'

/**
 * A fixed, looping, muted video layer used when Settings > Appearance >
 * Background is set to "Video". Rendered as a real <video> element (a CSS
 * background-image can't play video), mounted once at the app root so it
 * sits behind the sidebar/topbar/content but above the ambient glow — see
 * the stacking-order note in App.tsx.
 */
export function BackgroundVideo() {
  const background = useSettings((s) => s.background)
  const ref = useRef<HTMLVideoElement>(null)
  const bg = withVideoDefaults(background)

  useEffect(() => {
    const el = ref.current
    if (el) el.playbackRate = bg.videoSpeed
  }, [bg.videoSpeed, bg.value])

  if (bg.type !== 'video' || !bg.value) return null

  return (
    <video
      ref={ref}
      className="bg-video-layer"
      src={assetUrl(bg.value)}
      autoPlay
      loop
      muted={bg.videoMuted}
      playsInline
      disablePictureInPicture
      aria-hidden="true"
      style={{
        opacity: bg.opacity,
        filter: `brightness(${bg.videoBrightness}) blur(${bg.videoBlur}px)`,
      }}
    />
  )
}
