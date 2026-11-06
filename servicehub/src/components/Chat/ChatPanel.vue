<script setup>
// One chat screen for customers, providers and admins.
//
// Left: the signed in user's chats (booking chats and the admin chat), with
// unread counts. Right: the open chat. Both refresh every 5 seconds while the
// tab is visible, and the open chat only asks for messages newer than the
// last one it already has, so the refresh stays small.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as api from '../../services/api'

const REFRESH_MS = 5000

const props = defineProps({
  // 'customer', 'provider' or 'admin'
  role: { type: String, required: true },
  // admin only: customers and providers they can start a chat with
  accounts: { type: Array, default: () => [] },
  // open the chat for this booking when it appears (the "Message" buttons)
  focusBookingId: { type: String, default: '' }
})

const emit = defineEmits(['unread'])

const chats = ref([])
const activeId = ref('')
const messages = ref([])
const draft = ref('')
const loadingList = ref(true)
const loadingThread = ref(false)
const sending = ref(false)
const error = ref('')
const threadEl = ref(null)
const pickedAccount = ref('')
const search = ref('')
let timer = null
let refreshing = false

const activeChat = computed(() => chats.value.find(c => c.conversationId === activeId.value) || null)
const me = computed(() => props.role)

const visibleChats = computed(() => {
  const term = search.value.trim().toLowerCase()
  if (!term) return chats.value
  return chats.value.filter(c => `${c.title} ${c.subtitle}`.toLowerCase().includes(term))
})

const pickableAccounts = computed(() =>
  props.accounts
    .filter(a => a.role === 'customer' || a.role === 'provider')
    .slice()
    .sort((a, b) => String(a.name).localeCompare(String(b.name)))
)

const emptyText = computed(() => {
  if (props.role === 'admin') return 'No conversations yet. Start one with a customer or provider above.'
  if (props.role === 'provider') return 'Chats with customers appear here once an admin assigns you a job.'
  return 'Chats with your provider appear here once an admin assigns one to your booking.'
})

function totalUnread() {
  return chats.value.reduce((sum, c) => sum + (c.conversationId === activeId.value ? 0 : c.unread || 0), 0)
}

async function loadChats() {
  try {
    const list = await api.getChats()
    chats.value = list.map(c => (c.conversationId === activeId.value ? { ...c, unread: 0 } : c))
    error.value = ''
    emit('unread', chats.value.reduce((sum, c) => sum + (c.unread || 0), 0))
    focusBooking()
  } catch (err) {
    error.value = err.message || 'Could not load your chats.'
  } finally {
    loadingList.value = false
  }
}

function focusBooking() {
  if (!props.focusBookingId) return
  const chat = chats.value.find(c => c.bookingId === props.focusBookingId)
  if (chat && chat.conversationId !== activeId.value) openChat(chat.conversationId)
}

function newestTime() {
  const last = messages.value[messages.value.length - 1]
  return last ? new Date(last.createdAt).toISOString() : ''
}

function addMessages(list) {
  const known = new Set(messages.value.map(m => m.messageId))
  const fresh = list.filter(m => !known.has(m.messageId))
  if (!fresh.length) return false
  messages.value = [...messages.value, ...fresh]
  return true
}

async function scrollToBottom() {
  await nextTick()
  if (threadEl.value) threadEl.value.scrollTop = threadEl.value.scrollHeight
}

async function openChat(conversationId) {
  if (!conversationId) return
  activeId.value = conversationId
  messages.value = []
  draft.value = ''
  loadingThread.value = true
  try {
    messages.value = await api.getChatMessages(conversationId)
    chats.value = chats.value.map(c => (c.conversationId === conversationId ? { ...c, unread: 0 } : c))
    emit('unread', totalUnread())
    await scrollToBottom()
  } catch (err) {
    error.value = err.message || 'Could not open this chat.'
  } finally {
    loadingThread.value = false
  }
}

async function refreshThread() {
  if (!activeId.value || loadingThread.value) return
  const id = activeId.value
  const after = newestTime()
  const fresh = await api.getChatMessages(id, after || undefined)
  if (id !== activeId.value) return
  const nearBottom = threadEl.value
    ? threadEl.value.scrollHeight - threadEl.value.scrollTop - threadEl.value.clientHeight < 80
    : true
  if (addMessages(fresh) && nearBottom) await scrollToBottom()
}

async function refresh() {
  if (refreshing || document.hidden) return
  refreshing = true
  try {
    await Promise.all([loadChats(), refreshThread()])
  } catch (err) {
    error.value = err.message || 'Could not refresh the chat.'
  } finally {
    refreshing = false
  }
}

async function send() {
  const body = draft.value.trim()
  if (!body || !activeId.value || sending.value) return
  sending.value = true
  error.value = ''
  try {
    const saved = await api.sendChatMessage(activeId.value, body)
    addMessages([saved])
    draft.value = ''
    chats.value = chats.value.map(c =>
      c.conversationId === activeId.value
        ? { ...c, lastMessage: { body: saved.body, senderType: saved.senderType, senderName: saved.senderName, createdAt: saved.createdAt }, lastMessageAt: saved.createdAt }
        : c
    )
    await scrollToBottom()
  } catch (err) {
    error.value = err.message || 'Your message was not sent. Please try again.'
  } finally {
    sending.value = false
  }
}

function onKeydown(event) {
  // Enter sends, Shift+Enter makes a new line
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    send()
  }
}

async function startChat() {
  const account = props.accounts.find(a => `${a.role}:${a.id}` === pickedAccount.value)
  if (!account) return
  error.value = ''
  try {
    const chat = await api.startSupportChat(account.role, account.id)
    if (!chats.value.some(c => c.conversationId === chat.conversationId)) {
      chats.value = [chat, ...chats.value]
    }
    pickedAccount.value = ''
    await openChat(chat.conversationId)
  } catch (err) {
    error.value = err.message || 'Could not start the chat.'
  }
}

function isMine(message) {
  return message.senderType === me.value
}

function senderLabel(message) {
  if (message.senderType === 'admin') return props.role === 'admin' ? message.senderName : 'ServiceHub admin'
  return message.senderName
}

function timeLabel(value) {
  if (!value) return ''
  const date = new Date(value)
  const today = new Date()
  const sameDay = date.toDateString() === today.toDateString()
  return sameDay
    ? date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : date.toLocaleDateString([], { day: 'numeric', month: 'short' }) + ', ' +
      date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function preview(chat) {
  if (!chat.lastMessage) return 'No messages yet'
  const who = chat.lastMessage.senderType === me.value ? 'You: ' : ''
  return who + chat.lastMessage.body
}

function kindLabel(chat) {
  if (chat.type === 'booking') return props.role === 'admin' ? `Booking · ${chat.subtitle}` : chat.subtitle
  return chat.subtitle
}

watch(() => props.focusBookingId, focusBooking)

function onVisibility() {
  if (!document.hidden) refresh()
}

onMounted(async () => {
  await loadChats()
  if (!activeId.value && chats.value.length && window.innerWidth > 760) {
    await openChat(chats.value[0].conversationId)
  }
  timer = window.setInterval(refresh, REFRESH_MS)
  document.addEventListener('visibilitychange', onVisibility)
})

onBeforeUnmount(() => {
  window.clearInterval(timer)
  document.removeEventListener('visibilitychange', onVisibility)
})
</script>

<template>
  <section class="chat-panel" :class="{ 'has-active': activeId }">
    <aside class="chat-list" aria-label="Conversations">
      <div class="chat-list-head">
        <h2>Messages</h2>
        <input v-model="search" type="search" placeholder="Search chats" aria-label="Search chats" />
      </div>

      <div v-if="role === 'admin'" class="chat-start">
        <select v-model="pickedAccount" aria-label="Start a chat with">
          <option value="">Message a customer or provider…</option>
          <optgroup label="Customers">
            <option v-for="a in pickableAccounts.filter(x => x.role === 'customer')" :key="a.id"
              :value="`customer:${a.id}`">{{ a.name }}</option>
          </optgroup>
          <optgroup label="Providers">
            <option v-for="a in pickableAccounts.filter(x => x.role === 'provider')" :key="a.id"
              :value="`provider:${a.id}`">{{ a.name }}</option>
          </optgroup>
        </select>
        <button class="primary small" :disabled="!pickedAccount" @click="startChat">Open</button>
      </div>

      <div v-if="loadingList" class="chat-empty">Loading chats…</div>
      <div v-else-if="!visibleChats.length" class="chat-empty">{{ search ? 'No chats match your search.' : emptyText }}</div>

      <button v-for="chat in visibleChats" :key="chat.conversationId" class="chat-item"
        :class="{ active: chat.conversationId === activeId, unread: chat.unread }" @click="openChat(chat.conversationId)">
        <span class="chat-item-top">
          <strong>{{ chat.title }}</strong>
          <small v-if="chat.lastMessageAt">{{ timeLabel(chat.lastMessageAt) }}</small>
        </span>
        <span class="chat-item-kind">{{ kindLabel(chat) }}</span>
        <span class="chat-item-bottom">
          <span class="chat-preview">{{ preview(chat) }}</span>
          <span v-if="chat.unread" class="chat-badge" :aria-label="`${chat.unread} unread`">{{ chat.unread }}</span>
        </span>
      </button>
    </aside>

    <div class="chat-thread">
      <template v-if="activeChat">
        <header class="chat-thread-head">
          <button class="chat-back secondary small" @click="activeId = ''" aria-label="Back to chats">←</button>
          <div>
            <strong>{{ activeChat.title }}</strong>
            <small>{{ activeChat.subtitle }}</small>
          </div>
        </header>

        <div ref="threadEl" class="chat-messages" aria-live="polite">
          <div v-if="loadingThread" class="chat-empty">Loading messages…</div>
          <div v-else-if="!messages.length" class="chat-empty">
            No messages yet. Say hello{{ activeChat.type === 'booking' ? ' and confirm the details of the job' : '' }}.
          </div>
          <div v-for="m in messages" :key="m.messageId" class="chat-bubble" :class="{ mine: isMine(m), admin: m.senderType === 'admin' && !isMine(m) }">
            <span v-if="!isMine(m)" class="chat-sender">{{ senderLabel(m) }}</span>
            <p>{{ m.body }}</p>
            <time :datetime="m.createdAt">{{ timeLabel(m.createdAt) }}</time>
          </div>
        </div>

        <form class="chat-compose" @submit.prevent="send">
          <textarea v-model="draft" rows="1" maxlength="2000" placeholder="Type a message" aria-label="Message"
            @keydown="onKeydown"></textarea>
          <button class="primary" type="submit" :disabled="sending || !draft.trim()">{{ sending ? 'Sending…' : 'Send' }}</button>
        </form>
      </template>

      <div v-else class="chat-placeholder">
        <strong>Select a chat</strong>
        <p class="muted">Messages refresh every few seconds.</p>
      </div>

    </div>
  </section>
  <p v-if="error" class="chat-error" role="alert">{{ error }}</p>
</template>

<style scoped>
.chat-panel {
  display: grid;
  grid-template-columns: minmax(240px, 320px) 1fr;
  height: min(70vh, 640px);
  min-height: 420px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.chat-list {
  border-right: 1px solid var(--line);
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
}

.chat-list-head {
  padding: 16px 16px 8px;
  display: grid;
  gap: 10px;
}

.chat-list-head h2 {
  margin: 0;
  font-size: 1.1rem;
}

.chat-list-head input,
.chat-start select {
  width: 100%;
  min-width: 0;
}

.chat-start {
  display: flex;
  gap: 8px;
  padding: 0 16px 10px;
}

.chat-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  min-width: 0;
  gap: 2px;
  text-align: left;
  padding: 12px 16px;
  border: 0;
  border-top: 1px solid var(--line);
  border-radius: 0;
  background: transparent;
  color: var(--text);
  cursor: pointer;
  width: 100%;
  box-shadow: none;
}

.chat-item:hover {
  background: var(--bg-alt);
}

.chat-item.active {
  background: var(--brand-soft);
}

.chat-item-top,
.chat-item-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.chat-item-top strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-item-top small {
  flex-shrink: 0;
}

.chat-item small,
.chat-item-kind {
  color: var(--muted);
  font-size: .78rem;
}

.chat-preview {
  min-width: 0;
  color: var(--muted);
  font-size: .85rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-item.unread .chat-preview {
  color: var(--text);
  font-weight: 600;
}

.chat-badge {
  background: var(--brand);
  color: #fff;
  border-radius: 999px;
  min-width: 22px;
  padding: 1px 7px;
  font-size: .75rem;
  font-weight: 700;
  text-align: center;
}

.chat-thread {
  display: flex;
  flex-direction: column;
  min-width: 0;
  position: relative;
}

.chat-thread-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--line);
}

.chat-thread-head div {
  display: grid;
}

.chat-thread-head small {
  color: var(--muted);
}

.chat-back {
  display: none;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: var(--bg);
}

.chat-bubble {
  max-width: min(78%, 520px);
  padding: 9px 13px;
  border-radius: 16px 16px 16px 4px;
  background: var(--surface);
  border: 1px solid var(--line);
  align-self: flex-start;
}

.chat-bubble.mine {
  align-self: flex-end;
  background: var(--brand);
  border-color: var(--brand);
  color: #fff;
  border-radius: 16px 16px 4px 16px;
}

.chat-bubble.admin {
  border-color: var(--line-strong);
  background: var(--brand-soft);
}

.chat-bubble p {
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.chat-sender {
  display: block;
  font-size: .75rem;
  font-weight: 700;
  color: var(--brand);
  margin-bottom: 2px;
}

.chat-bubble time {
  display: block;
  font-size: .7rem;
  opacity: .7;
  margin-top: 4px;
  text-align: right;
}

.chat-compose {
  display: flex;
  gap: 10px;
  padding: 12px 14px;
  border-top: 1px solid var(--line);
  background: var(--surface);
}

.chat-compose textarea {
  flex: 1;
  resize: none;
  min-height: 44px;
  max-height: 140px;
  font: inherit;
}

.chat-empty,
.chat-placeholder {
  padding: 24px 16px;
  color: var(--muted);
  text-align: center;
}

.chat-placeholder {
  margin: auto;
}

.chat-placeholder p {
  margin: 4px 0 0;
}

.chat-error {
  margin: 10px 0 0;
  border-radius: var(--radius-sm);
  padding: 8px 14px;
  background: var(--danger-bg);
  color: var(--danger);
  font-size: .85rem;
}

@media (max-width: 760px) {
  .chat-panel {
    grid-template-columns: 1fr;
    height: 75vh;
  }

  .chat-panel.has-active .chat-list {
    display: none;
  }

  .chat-panel:not(.has-active) .chat-thread {
    display: none;
  }

  .chat-list {
    border-right: 0;
  }

  .chat-back {
    display: inline-flex;
  }

  .chat-bubble {
    max-width: 88%;
  }
}
</style>
