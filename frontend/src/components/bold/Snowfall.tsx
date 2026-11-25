import { useEffect, useRef } from 'react'

interface Flake {
  x: number
  y: number
  r: number
  speed: number
  drift: number
  phase: number
  alpha: number
}

/**
 * Falling snow for the "BRoffice Bold Коледа" design, drawn on one canvas.
 *
 * - `page`: fixed behind the whole site (z-index -1), so it shows in the
 *   gaps between cards and never covers text, prices or buttons. Flakes are
 *   pale icy blue so they read on the light cream background.
 * - `hero`: fills its (positioned) parent, pure white, for the dark hero.
 *
 * Never takes clicks, pauses while the tab is hidden, and with
 * prefers-reduced-motion it draws one still frame instead of animating.
 */
export function Snowfall({ variant = 'page' }: { variant?: 'page' | 'hero' }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const onLight = variant === 'page'
    let flakes: Flake[] = []
    let width = 0
    let height = 0
    let frame = 0

    function makeFlake(anywhere: boolean): Flake {
      const r = 1 + Math.random() * (onLight ? 2.6 : 2.2)
      return {
        x: Math.random() * width,
        y: anywhere ? Math.random() * height : -r * 2,
        r,
        // Bigger flakes are "closer": they fall faster.
        speed: 0.25 + r * 0.22 + Math.random() * 0.2,
        drift: 0.3 + Math.random() * 0.6,
        phase: Math.random() * Math.PI * 2,
        alpha: 0.55 + Math.random() * 0.45,
      }
    }

    function resize() {
      const box = variant === 'page' ? null : canvas!.parentElement?.getBoundingClientRect()
      width = box ? box.width : window.innerWidth
      height = box ? box.height : window.innerHeight
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas!.width = Math.round(width * dpr)
      canvas!.height = Math.round(height * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      // About one flake per 9,000 px², capped so big screens stay smooth.
      const count = Math.min(170, Math.round((width * height) / 9000))
      flakes = Array.from({ length: count }, () => makeFlake(true))
    }

    function draw() {
      ctx!.clearRect(0, 0, width, height)
      for (const f of flakes) {
        ctx!.beginPath()
        ctx!.arc(f.x, f.y, f.r, 0, Math.PI * 2)
        // White would vanish on the cream page, so there the flakes are a
        // pale icy blue; on the dark hero they are plain white.
        ctx!.fillStyle = onLight
          ? `rgba(176, 200, 226, ${f.alpha * 0.85})`
          : `rgba(255, 255, 255, ${f.alpha})`
        ctx!.fill()
      }
    }

    function step(time: number) {
      for (let i = 0; i < flakes.length; i++) {
        const f = flakes[i]
        f.y += f.speed
        f.x += Math.sin(time / 1400 + f.phase) * f.drift * 0.5
        if (f.y > height + f.r * 2 || f.x < -10 || f.x > width + 10) flakes[i] = makeFlake(false)
      }
      draw()
      frame = requestAnimationFrame(step)
    }

    function start() {
      cancelAnimationFrame(frame)
      if (!document.hidden) frame = requestAnimationFrame(step)
    }

    resize()
    if (reduceMotion) {
      draw()
      return
    }
    start()
    const observer = new ResizeObserver(resize)
    if (variant === 'hero' && canvas.parentElement) observer.observe(canvas.parentElement)
    else window.addEventListener('resize', resize)
    document.addEventListener('visibilitychange', start)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', start)
    }
  }, [variant])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={
        variant === 'page'
          ? 'pointer-events-none fixed inset-0 -z-10 h-full w-full'
          : 'pointer-events-none absolute inset-0 h-full w-full'
      }
    />
  )
}
