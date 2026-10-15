/**
 * Alarma de "llegó un pedido": tres pitidos fuertes repetidos dos veces, hechos
 * con Web Audio (sin archivos). Los navegadores solo dejan sonar después de que
 * la persona tocó la página, por eso `unlockAlertSound` se engancha al primer clic.
 */

let ctx: AudioContext | null = null

function context(): AudioContext | null {
  try {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext
    if (!Ctor) return null
    ctx ??= new Ctor()
    return ctx
  } catch {
    return null
  }
}

/** Llamar en un gesto del usuario (clic/tecla) para que el navegador permita el audio. */
export function unlockAlertSound() {
  const c = context()
  if (c && c.state === 'suspended') c.resume().catch(() => {})
}

export function playOrderAlert() {
  const c = context()
  if (!c) return
  if (c.state === 'suspended') c.resume().catch(() => {})
  const start = c.currentTime + 0.05
  // Dos rondas de tres pitidos agudos, a volumen alto.
  const pattern = [0, 0.22, 0.44, 1.0, 1.22, 1.44]
  pattern.forEach((offset, i) => {
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = 'square'
    osc.frequency.value = i % 3 === 2 ? 1320 : 990
    const t = start + offset
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.9, t + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18)
    osc.connect(gain).connect(c.destination)
    osc.start(t)
    osc.stop(t + 0.2)
  })
}
