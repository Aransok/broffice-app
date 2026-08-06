let audioContext: AudioContext | null = null

/** Two-tone "ding" generated with the Web Audio API — no bundled audio file
 * (no licensing/asset to manage), works everywhere modern browsers do.
 * Browsers block audio before any user gesture on the page; since this only
 * ever fires from a poll well after the admin has already clicked/typed
 * something, that's normally satisfied — but the try/catch means a blocked
 * context just skips the sound instead of throwing, the visual badge still
 * updates either way. */
export function playNotificationSound() {
  try {
    audioContext ??= new AudioContext()
    const ctx = audioContext
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(880, ctx.currentTime)
    oscillator.frequency.setValueAtTime(1046, ctx.currentTime + 0.12)
    gain.gain.setValueAtTime(0.001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    oscillator.connect(gain)
    gain.connect(ctx.destination)
    oscillator.start(ctx.currentTime)
    oscillator.stop(ctx.currentTime + 0.4)
  } catch {
    // Autoplay-blocked or unsupported — the visual unread badge still works.
  }
}
