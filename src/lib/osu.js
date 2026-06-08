// Pure helpers shared across overlay views (ported verbatim from the original scripts).

// HP bar colour: 0% -> red, 100% -> green (shared by gameplay & actions headers).
export function hpColor(percent) {
  const clamped = Math.max(0, Math.min(100, Number(percent) || 0))
  const hue = (clamped / 100) * 120
  return `hsl(${hue}, 80%, 45%)`
}

export function formatTime(ms) {
  const seconds = Math.floor(ms / 1000)
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`
}

export function formatNumber(value) {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

// --- mods stat conversion (gameplay map info) ---
export function convertAR(ar, mods) {
  if (mods.includes('HR')) return Math.min(10, ar * 1.4)
  else if (mods.includes('EZ')) return ar * 0.5
  else if (mods.includes('DT')) return (ar * 2 + 13) / 3
  else return ar
}

export function convertCS(cs, mods) {
  if (mods.includes('HR')) return Math.min(10, cs * 1.3)
  else if (mods.includes('EZ')) return cs * 0.5
  else return cs
}

export function convertOD(od, mods) {
  if (mods.includes('HR')) return Math.min(10, od * 1.4)
  else if (mods.includes('EZ')) return od * 0.5
  else if (mods.includes('DT')) return (od * 2 + 13) / 3 + 0.11
  else return od
}

export function convertBPM(bpm, mods) {
  if (mods.includes('DT')) return bpm * 1.5
  else return bpm
}

export function convertedTime(time, mods) {
  if (mods.includes('DT')) return time / 1.5
  else return time
}

// --- gameplay score bar styling ---
export function scoreBarStyle(barWidth) {
  const barPosition = { width: `${Math.abs(barWidth)}px` }
  const barStyle =
    barWidth >= 0
      ? { right: '50%', borderBottomLeftRadius: '15px' }
      : { left: '50%', borderBottomRightRadius: '15px' }
  return { ...barPosition, ...barStyle }
}

export function extendedScoreBarStyle(barWidth, borderWidth = 0) {
  if (barWidth >= 0 && borderWidth >= 0)
    return {
      right: '50%',
      width: `${Math.abs(barWidth) + Math.abs(borderWidth)}px`,
      backgroundColor: '#E57373',
      borderBottomLeftRadius: '15px',
    }
  else if (barWidth < 0 && borderWidth < 0)
    return {
      left: '50%',
      width: `${Math.abs(barWidth) + Math.abs(borderWidth)}px`,
      backgroundColor: '#64B5F6',
      borderBottomRightRadius: '15px',
    }
  else return { width: '0px' }
}

export function reversedScoreBarStyle(barWidth, borderWidth = 0) {
  if (barWidth < 0 && borderWidth >= 0)
    return { right: '50%', width: `${Math.abs(borderWidth)}px`, backgroundColor: '#E57373' }
  else if (barWidth >= 0 && borderWidth < 0)
    return { left: '50%', width: `${Math.abs(borderWidth)}px`, backgroundColor: '#64B5F6' }
  else return { width: '0px' }
}

export function scoreSize(value) {
  if (value >= 0) return { fontSize: '38px', transform: 'translateY(-4px)' }
  else return { fontSize: '25px', transform: 'translateY(2px)' }
}
