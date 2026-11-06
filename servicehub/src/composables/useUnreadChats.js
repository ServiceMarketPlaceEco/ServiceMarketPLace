// Unread chat count for the "Messages" tab badge on each dashboard.
// Checks every 15 seconds while the tab is visible. The chat screen itself
// refreshes faster (every 5 seconds) and reports its own count through
// setUnread, so the badge updates straight away while you are reading.
import { onBeforeUnmount, onMounted, ref } from 'vue'
import * as api from '../services/api'

const CHECK_MS = 15000

export function useUnreadChats() {
  const unread = ref(0)
  let timer = null

  async function check() {
    if (document.hidden) return
    try {
      const chats = await api.getChats()
      unread.value = chats.reduce((sum, chat) => sum + (chat.unread || 0), 0)
    } catch {
      // the badge is a nice-to-have, so a failed check just keeps the old number
    }
  }

  function setUnread(count) {
    unread.value = count
  }

  onMounted(() => {
    check()
    timer = window.setInterval(check, CHECK_MS)
  })

  onBeforeUnmount(() => window.clearInterval(timer))

  return { unread, setUnread, check }
}
