// Tiny WebAudio SFX — synthesized blips, no asset files. The AudioContext is created
// lazily and resumed on first use (it's first triggered by a key press, which satisfies
// browser autoplay rules). Mute persists in localStorage.
let ctx = null
let muted = (typeof localStorage !== 'undefined' && localStorage.getItem('jumper_muted') === '1')

function ac() {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

// One enveloped oscillator. `slideTo` glides the pitch over the note's duration.
function tone(freq, dur, { type = 'sine', gain = 0.12, slideTo = null, delay = 0 } = {}) {
  if (muted) return
  const c = ac()
  if (!c) return
  const t0 = c.currentTime + delay
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t0)
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur)
  g.gain.setValueAtTime(gain, t0)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  o.connect(g); g.connect(c.destination)
  o.start(t0); o.stop(t0 + dur)
}

export const Sound = {
  jump()    { tone(330, 0.12, { type: 'square',   gain: 0.07, slideTo: 520 }) },
  land()    { tone(180, 0.09, { type: 'sine',     gain: 0.09, slideTo: 90 }) },
  kick()    { tone(440, 0.10, { type: 'sawtooth', gain: 0.08, slideTo: 720 }) },
  pogo()    { tone(520, 0.14, { type: 'square',   gain: 0.10, slideTo: 900 }) },
  bounce()  { tone(400, 0.14, { type: 'square',   gain: 0.10, slideTo: 780 }) },
  pickup()  { tone(660, 0.08, { type: 'triangle', gain: 0.10, slideTo: 990 }) },
  discover() {
    tone(784, 0.12, { type: 'triangle', gain: 0.10 })
    tone(1175, 0.20, { type: 'triangle', gain: 0.10, delay: 0.10 })
  },
  bell() {
    tone(587, 0.9, { type: 'sine', gain: 0.12 })
    tone(880, 0.9, { type: 'sine', gain: 0.05 })
  },
  isMuted() { return muted },
  toggleMute() {
    muted = !muted
    if (typeof localStorage !== 'undefined') localStorage.setItem('jumper_muted', muted ? '1' : '0')
    return muted
  },
}
