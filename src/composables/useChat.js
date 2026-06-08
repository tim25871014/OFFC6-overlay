import { reactive } from 'vue'

// Chat message derivation shared by gameplay & actions. Call update() from the
// tosu socket handler; the returned reactive `chat` feeds <ChatPanel>.
export function useChat() {
  const chat = reactive({ messages: [], showChat: false })

  const update = (tourneyMng, chatMode = false) => {
    chat.showChat = tourneyMng?.scoreVisible === false || chatMode
    const nextMessages = Array.isArray(tourneyMng?.chat) ? tourneyMng.chat : []
    chat.messages = nextMessages
      .filter((item) => item?.name !== 'BanchoBot')
      .filter((item) => !(item?.message || '').startsWith('Match history'))
      .map((item) => ({
        timestamp: item?.timestamp || '',
        name: item?.name || '',
        message: item?.message || '',
        team: item?.team || '',
      }))
      .reverse()
  }

  return { chat, update }
}
