import { useEffect, useRef } from 'react'

/**
 * A soft, slowly moving aurora drawn on a 2D canvas (no WebGL, no library):
 * a handful of large radial gradients that drift on sine curves and lean
 * toward the mouse. Cheap enough to run full-time; paused when off-screen
 * or when the visitor prefers reduced motion.
 */
export function Aurora({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const blobs = [
      { c: [47, 95, 214], r: 0.55, x: 0.2, y: 0.3, sx: 0.9, sy: 0.7, p: 0 },
      { c: [255, 107, 31], r: 0.5, x: 0.85, y: 0.8, sx: 0.6, sy: 1.1, p: 2 },
      { c: [20, 184, 166], r: 0.4, x: 0.6, y: 0.2, sx: 1.2, sy: 0.8, p: 4 },
      { c: [168, 85, 247], r: 0.35, x: 0.4, y: 0.9, sx: 0.8, sy: 0.5, p: 1 },
    ]
    let w = 0
    let h = 0
    let raf = 0
    let visible = true
    const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 }

    function resize() {
      const rect = canvas!.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      w = Math.max(1, Math.floor(rect.width * 0.5))
      h = Math.max(1, Math.floor(rect.height * 0.5))
      canvas!.width = w * dpr
      canvas!.height = h * dpr
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    function frame(t: number) {
      const time = reduced ? 0 : t / 1000
      mouse.x += (mouse.tx - mouse.x) * 0.04
      mouse.y += (mouse.ty - mouse.y) * 0.04
      ctx!.clearRect(0, 0, w, h)
      ctx!.globalCompositeOperation = 'lighter'
      for (const b of blobs) {
        const x = (b.x + Math.sin(time * 0.25 * b.sx + b.p) * 0.12 + (mouse.x - 0.5) * 0.12) * w
        const y = (b.y + Math.cos(time * 0.2 * b.sy + b.p) * 0.12 + (mouse.y - 0.5) * 0.12) * h
        const r = b.r * Math.max(w, h)
        const g = ctx!.createRadialGradient(x, y, 0, x, y, r)
        g.addColorStop(0, `rgba(${b.c.join(',')},0.75)`)
        g.addColorStop(1, `rgba(${b.c.join(',')},0)`)
        ctx!.fillStyle = g
        ctx!.fillRect(x - r, y - r, r * 2, r * 2)
      }
      if (visible && !reduced) raf = requestAnimationFrame(frame)
    }

    function onMove(event: PointerEvent) {
      const rect = canvas!.getBoundingClientRect()
      mouse.tx = (event.clientX - rect.left) / rect.width
      mouse.ty = (event.clientY - rect.top) / rect.height
    }

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      if (visible && !reduced) {
        cancelAnimationFrame(raf)
        raf = requestAnimationFrame(frame)
      }
    })
    io.observe(canvas)
    resize()
    raf = requestAnimationFrame(frame)
    window.addEventListener('resize', resize)
    canvas.parentElement?.addEventListener('pointermove', onMove)
    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      window.removeEventListener('resize', resize)
      canvas.parentElement?.removeEventListener('pointermove', onMove)
    }
  }, [])

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      style={{ filter: 'blur(40px) saturate(1.3)' }}
    />
  )
}
