import { useEffect, useRef } from 'react'
import { useSettings } from '../stores/settings'

type Vec = { x: number; y: number }

interface RainDrop {
  x: number
  y: number
  len: number
  speed: number
  opacity: number
}
interface Snowflake {
  x: number
  y: number
  r: number
  speed: number
  drift: number
  phase: number
}
interface Ember {
  x: number
  y: number
  vx: number
  vy: number
  age: number
  life: number
  r: number
}
interface TrailPoint extends Vec {
  r: number
}
interface Droplet {
  x: number
  y: number
  r: number
  maxR: number
  vy: number
  wobblePhase: number
  wobbleSpeed: number
  sliding: boolean
  holdFrames: number
  trail: TrailPoint[]
}
/** Static condensation on the glass — tiny fixed specks a sliding droplet
 * clears a path through, the way a real drop of water on a foggy window
 * leaves a streak of clear glass behind it. */
interface MistSpeck {
  x: number
  y: number
  r: number
  a: number
}

const RAIN_ANGLE = 0.22 // radians, gentle lean

/**
 * Ambient, decorative full-screen overlay (rain / snow / fire / water
 * droplets) drawn on a single fixed canvas. Purely cosmetic — pointer-events
 * are disabled so it never intercepts clicks — and it sits above the
 * background layer but below the app chrome by DOM order (see App.tsx).
 *
 * Self-contained canvas 2D particle sim, no external dependency: keeps the
 * app's bundle small and the effect fully offline.
 */
export function OverlayEffects() {
  const effect = useSettings((s) => s.overlayEffect)
  const intensity = useSettings((s) => s.overlayIntensity)
  const animation = useSettings((s) => s.animation)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (effect === 'none' || animation === 'off') return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let w = 0
    let h = 0
    let dpr = Math.min(window.devicePixelRatio || 1, 2)

    const resize = () => {
      w = window.innerWidth
      h = window.innerHeight
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const rand = (a: number, b: number) => a + Math.random() * (b - a)
    const clampIntensity = Math.max(0.15, Math.min(1.8, intensity))

    // --- rain --------------------------------------------------------------
    const spawnRain = (n: number): RainDrop[] =>
      Array.from({ length: n }, () => ({
        x: rand(-100, w + 100),
        y: rand(-h, h),
        len: rand(14, 34),
        speed: rand(9, 17),
        opacity: rand(0.12, 0.32),
      }))
    let rain: RainDrop[] = []

    // --- snow ----------------------------------------------------------------
    const spawnSnow = (n: number): Snowflake[] =>
      Array.from({ length: n }, () => ({
        x: rand(0, w),
        y: rand(-h, h),
        r: rand(1.2, 3.6),
        speed: rand(0.4, 1.4),
        drift: rand(0.3, 1.1),
        phase: rand(0, Math.PI * 2),
      }))
    let snow: Snowflake[] = []

    // --- fire ----------------------------------------------------------------
    let embers: Ember[] = []
    let emberClock = 0

    // --- droplets (rain sliding on glass) -----------------------------------
    let droplets: Droplet[] = []
    let dropletClock = 0
    let mist: MistSpeck[] = []
    let mistClock = 0

    const spawnMistSpecks = (n: number): MistSpeck[] =>
      Array.from({ length: n }, () => ({
        x: rand(0, w),
        y: rand(0, h),
        r: rand(0.6, 2.2),
        a: rand(0.05, 0.16),
      }))

    const count = (base: number) => Math.round(base * clampIntensity)

    if (effect === 'rain') rain = spawnRain(count(220))
    if (effect === 'snow') snow = spawnSnow(count(130))
    if (effect === 'droplets') mist = spawnMistSpecks(count(260))

    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(48, now - last)
      last = now
      ctx.clearRect(0, 0, w, h)

      if (effect === 'rain') {
        ctx.strokeStyle = 'rgba(190, 210, 255, 1)'
        ctx.lineCap = 'round'
        for (const d of rain) {
          ctx.globalAlpha = d.opacity
          ctx.lineWidth = 1.1
          const dx = Math.sin(RAIN_ANGLE) * d.len
          const dy = Math.cos(RAIN_ANGLE) * d.len
          ctx.beginPath()
          ctx.moveTo(d.x, d.y)
          ctx.lineTo(d.x + dx, d.y + dy)
          ctx.stroke()
          d.y += d.speed * (dt / 16)
          d.x += Math.sin(RAIN_ANGLE) * d.speed * 0.4 * (dt / 16)
          if (d.y > h + 20) {
            d.y = rand(-60, -10)
            d.x = rand(-100, w + 100)
          }
        }
        ctx.globalAlpha = 1
      } else if (effect === 'snow') {
        ctx.fillStyle = 'rgba(255,255,255,1)'
        for (const f of snow) {
          ctx.globalAlpha = 0.55
          ctx.shadowColor = 'rgba(255,255,255,0.8)'
          ctx.shadowBlur = 3
          ctx.beginPath()
          ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2)
          ctx.fill()
          f.y += f.speed * (dt / 16)
          f.x += Math.sin(now * 0.0009 + f.phase) * f.drift * 0.06 * (dt / 16)
          if (f.y > h + 6) {
            f.y = rand(-40, -6)
            f.x = rand(0, w)
          }
        }
        ctx.shadowBlur = 0
        ctx.globalAlpha = 1
      } else if (effect === 'fire') {
        emberClock += dt
        const emitEvery = Math.max(6, 26 - clampIntensity * 14)
        while (emberClock > emitEvery) {
          emberClock -= emitEvery
          const bandCount = Math.max(1, Math.round(clampIntensity))
          for (let i = 0; i < bandCount; i++) {
            embers.push({
              x: rand(w * 0.08, w * 0.92),
              y: h + rand(0, 20),
              vx: rand(-0.35, 0.35),
              vy: rand(-2.6, -1.5) * (0.7 + clampIntensity * 0.4),
              age: 0,
              life: rand(900, 1900),
              r: rand(2, 5.5),
            })
          }
        }
        ctx.globalCompositeOperation = 'lighter'
        embers = embers.filter((e) => e.age < e.life)
        for (const e of embers) {
          e.age += dt
          e.x += e.vx * (dt / 16)
          e.vx += rand(-0.05, 0.05)
          e.y += e.vy * (dt / 16)
          const t = e.age / e.life
          const r = Math.max(0, e.r * (1 - t * 0.8))
          const hue = 55 - t * 55 // yellow -> red
          ctx.globalAlpha = Math.max(0, (1 - t) * 0.85)
          ctx.fillStyle = `hsl(${hue}, 100%, ${60 - t * 20}%)`
          ctx.shadowColor = `hsl(${hue}, 100%, 55%)`
          ctx.shadowBlur = 8
          ctx.beginPath()
          ctx.arc(e.x, e.y, r, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.shadowBlur = 0
        ctx.globalAlpha = 1
        ctx.globalCompositeOperation = 'source-over'
      } else if (effect === 'droplets') {
        // Keep the fogged-glass texture topped up as drops clear paths
        // through it and old specks are never replaced.
        mistClock += dt
        if (mistClock > 700 && mist.length < count(260)) {
          mistClock = 0
          mist.push(...spawnMistSpecks(Math.max(1, count(6))))
        }
        ctx.fillStyle = 'rgba(220, 232, 250, 1)'
        for (const m of mist) {
          ctx.globalAlpha = m.a
          ctx.beginPath()
          ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.globalAlpha = 1

        dropletClock += dt
        const spawnEvery = Math.max(70, 340 - clampIntensity * 200)
        if (dropletClock > spawnEvery && droplets.length < count(50)) {
          dropletClock = 0
          droplets.push({
            x: rand(0.04 * w, 0.96 * w),
            y: rand(0.04 * h, 0.6 * h),
            r: 0,
            maxR: rand(2.6, 7),
            vy: 0,
            wobblePhase: rand(0, Math.PI * 2),
            wobbleSpeed: rand(0.0015, 0.004),
            sliding: false,
            holdFrames: rand(90, 360),
            trail: [],
          })
        }
        droplets = droplets.filter((d) => d.y < h + 20)

        for (const d of droplets) {
          if (d.r < d.maxR) d.r += 0.1 * (dt / 16)

          if (!d.sliding) {
            // Beading: sits still, slowly swelling, until gravity wins —
            // bigger drops (more weight) break free sooner.
            d.holdFrames -= (dt / 16) * (0.6 + d.r / d.maxR)
            if (d.holdFrames <= 0 && Math.random() < 0.025) d.sliding = true
          } else {
            // Heavier (bigger) drops accelerate down glass faster, and pick
            // up more speed the longer they run — real gravity-fed streaks.
            d.vy = Math.min(d.vy + (0.03 + d.r * 0.01) * (dt / 16), 2.6 + d.r * 0.35)
            d.x += Math.sin(d.wobblePhase) * 0.22
            d.wobblePhase += d.wobbleSpeed * dt

            // Merge with any mist speck in its path — it visibly clears the
            // fog as it slides and grows a little from what it absorbs.
            for (let i = mist.length - 1; i >= 0; i--) {
              const m = mist[i]
              const dx = m.x - d.x
              const dy = m.y - d.y
              if (dx * dx + dy * dy < (d.r * 0.85 + m.r) * (d.r * 0.85 + m.r)) {
                d.maxR = Math.min(d.maxR * 1.25, d.maxR + m.r * 0.5)
                mist.splice(i, 1)
              }
            }

            d.trail.push({ x: d.x, y: d.y, r: d.r })
            if (d.trail.length > 26) d.trail.shift()
            d.y += d.vy * (dt / 16)
          }

          // The wet streak: a clear-glass channel (very faint fill) with a
          // tapered highlight core — dim and thin where the drop passed long
          // ago, brightest and widest right behind the drop itself.
          if (d.trail.length > 1) {
            for (let i = 1; i < d.trail.length; i++) {
              const p0 = d.trail[i - 1]
              const p1 = d.trail[i]
              const t = i / d.trail.length
              ctx.strokeStyle = `rgba(200, 222, 250, ${0.03 + t * 0.16})`
              ctx.lineWidth = Math.max(0.5, p1.r * 0.42)
              ctx.lineCap = 'round'
              ctx.beginPath()
              ctx.moveTo(p0.x, p0.y)
              ctx.lineTo(p1.x, p1.y)
              ctx.stroke()
              // A thin bright core — the specular line light draws along a
              // wet streak on glass — only near the trailing (newest) end.
              if (t > 0.55) {
                ctx.strokeStyle = `rgba(255, 255, 255, ${(t - 0.55) * 0.5})`
                ctx.lineWidth = Math.max(0.4, p1.r * 0.16)
                ctx.beginPath()
                ctx.moveTo(p0.x, p0.y)
                ctx.lineTo(p1.x, p1.y)
                ctx.stroke()
              }
            }
          }

          // The drop itself: soft body + a tight specular highlight offset
          // toward the (implied) light source, like light bending through a
          // bead of water rather than a flat painted circle.
          const grad = ctx.createRadialGradient(
            d.x - d.r * 0.3,
            d.y - d.r * 0.35,
            0.15,
            d.x,
            d.y,
            d.r,
          )
          grad.addColorStop(0, 'rgba(255,255,255,0.55)')
          grad.addColorStop(0.4, 'rgba(215,232,252,0.4)')
          grad.addColorStop(0.78, 'rgba(160,190,230,0.22)')
          grad.addColorStop(1, 'rgba(140,170,215,0.08)')
          ctx.fillStyle = grad
          ctx.beginPath()
          ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2)
          ctx.fill()

          ctx.fillStyle = 'rgba(255,255,255,0.85)'
          ctx.globalAlpha = 0.75
          ctx.beginPath()
          ctx.ellipse(d.x - d.r * 0.32, d.y - d.r * 0.38, Math.max(0.4, d.r * 0.22), Math.max(0.3, d.r * 0.14), -0.6, 0, Math.PI * 2)
          ctx.fill()
          ctx.globalAlpha = 1
        }
      }

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      ctx.clearRect(0, 0, w, h)
    }
  }, [effect, intensity, animation])

  if (effect === 'none' || animation === 'off') return null

  return <canvas ref={canvasRef} className="overlay-effects-layer" aria-hidden="true" />
}
