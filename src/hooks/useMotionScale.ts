import { useSettings } from '../stores/settings'

/**
 * Duration multiplier for the user's chosen animation level (Settings →
 * Appearance). `0` means "off" — callers should skip transitions entirely
 * rather than run a zero-duration one, since framer-motion still fires
 * onAnimationComplete/layout work for a 0s tween.
 */
export const MOTION_LEVEL_SCALE = {
  off: 0,
  low: 0.55,
  medium: 1,
  high: 1.5,
} as const

export function useMotionScale(): number {
  return useSettings((s) => MOTION_LEVEL_SCALE[s.animation])
}

/** True when the user has turned animation off entirely. */
export function useMotionOff(): boolean {
  return useSettings((s) => s.animation === 'off')
}
