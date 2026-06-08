import { onMounted, onUnmounted } from 'vue'
import { getConfig } from '../lib/config'

// Opens the tosu websocket (URL from _data/config/endpoints.json) and invokes
// onData(parsedMessage) for every frame. The connection is created on mount and
// closed on unmount.
export function useTosuSocket(onData) {
  let ws = null

  onMounted(() => {
    ws = new WebSocket(getConfig().tosuSocketUrl)
    ws.onmessage = (event) => {
      let data
      try {
        data = JSON.parse(event.data)
      } catch {
        return
      }
      onData(data)
    }
  })

  onUnmounted(() => {
    if (ws) {
      ws.onmessage = null
      ws.close()
      ws = null
    }
  })
}
