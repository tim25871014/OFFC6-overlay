import { reactive, onMounted, onUnmounted } from 'vue'

// Polls localStorage['game-state'] (written by the score/bridge console) once per
// second and exposes reactive { gameStatus, gameEvent }. onTick(state) runs after
// every load, mirroring the original per-second update orchestration in each view.
export function useGameState(onTick, intervalMs = 1000) {
  const state = reactive({ gameStatus: {}, gameEvent: [] })
  let timer = null

  const load = () => {
    const value = localStorage.getItem('game-state')
    if (!value) return
    try {
      const newState = JSON.parse(value)
      state.gameStatus = newState.gameStatus || {}
      state.gameEvent = newState.gameEvent || []
    } catch {
      /* ignore malformed state */
    }
  }

  const tick = () => {
    load()
    if (typeof onTick === 'function') onTick(state)
  }

  onMounted(() => {
    timer = setInterval(tick, intervalMs)
  })
  onUnmounted(() => {
    if (timer) clearInterval(timer)
  })

  return state
}
