<script setup>
// The admin team's inbox: conversations with customers and providers.
// Left: every conversation with messages, newest first, with unread counts,
// and a picker to start a new one. Right: the open conversation.
// Admins share this inbox, so any admin can answer.
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import * as api from '../../services/api'

const REFRESH_MS = 5000

const props = defineProps({
  // customers and providers the admin can write to (from the admin dashboard)
  accounts: { type: Array, default: () => [] }
})

const emit = defineEmits(['unread'])

const threads = ref([])
const active = ref(null) // { userType, userId, userName }
const messages = ref([])
const draft = ref('')
const picked = ref('')
const loading = ref(true)
const sending = ref(false)
const error = ref('')
const listEl = ref(null)
let timer = null
let busy = false

const keyOf = t => `${t.userType}:${t.userId}`
const activeKey = computed(() => (active.value ? keyOf(active.value) : ''))

const pickable = computed(() =>
  props.accounts
    .filter(a => a.role === 'customer' || a.role === 'provider')
    .slice()
    .sort((a, b) => String(a.name).localeCompare(String(b.name)))
)

async function scrollToBottom() {
  await nextTick()
  if (listEl.value) listEl.value.scrollTop = listEl.value.scrollHeight
}

async function loadThreads() {
  const list = await api.getSupportThreads()
  // the open conversation is being read right now
  threads.value = list.map(t => (keyOf(t) === activeKey.value ? { ...t, unread: 0 } : t))
  emit('unread', threads.value.reduce((sum, t) => sum + (t.unread || 0), 0))
}

async function loadMessages(scroll) {
  if (!active.value) return
  const key = activeKey.value
  const fresh = await api.getSupportThreadMessages(active.value.userType, active.value.userId)
  if (key !== activeKey.value) return
  const grew = fresh.length !== messages.value.length
  messages.value = fresh
  if (scroll || grew) await scrollToBottom()
}

async function refresh(first = false) {
  if (busy || (!first && document.hidden)) return
  busy = true
  try {
    await Promise.all([loadThreads(), loadMessages(false)])
    error.value = ''
  } catch (err) {
    error.value = err.message || 'Could not load the inbox.'
  } finally {
    busy = false
    loading.value = false
  }
}

async function open(thread) {
  active.value = { userType: thread.userType, userId: thread.userId, userName: thread.userName }
  messages.value = []
  draft.value = ''
  error.value = ''
  try {
    await loadMessages(true)
    threads.value = threads.value.map(t => (keyOf(t) === activeKey.value ? { ...t, unread: 0 } : t))
    emit('unread', threads.value.reduce((sum, t) => sum + (t.unread || 0), 0))
  } catch (err) {
    error.value = err.message || 'Could not open this conversation.'
  }
}

function startConversation() {
  const account = pickable.value.find(a => `${a.role}:${a.id}` === picked.value)
  if (!account) return
  picked.value = ''
  open({ userType: account.role, userId: account.id, userName: account.name })
}

async function send() {
  const text = draft.value.trim()
  if (!text || !active.value || sending.value) return
  sending.value = true
  error.value = ''
  try {
    const saved = await api.sendSupportReply(active.value.userType, active.value.userId, text)
    messages.value = [...messages.value, saved]
    draft.value = ''
    await scrollToBottom()
    await loadThreads()
  } catch (err) {
    error.value = err.message || 'Your message was not sent. Please try again.'
  } finally {
    sending.value = false
  }
}

function onKeydown(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    send()
  }
}

function preview(thread) {
  if (!thread.lastMessage) return 'No messages yet'
  return (thread.lastMessage.senderType === 'admin' ? 'Admin: ' : '') + thread.lastMessage.message
}

function timeLabel(value) {
  if (!value) return ''
  return new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

onMounted(() => {
  refresh(true)
  timer = window.setInterval(refresh, REFRESH_MS)
})

onBeforeUnmount(() => window.clearInterval(timer))
</script>

<template>
  <section class="ops-panel">
    <div class="panel-heading">
      <h2>Messages</h2>
      <span>Customers and providers writing to the admin team</span>
    </div>

    <div class="inbox-start">
      <select v-model="picked" aria-label="Start a conversation with">
        <option value="">Write to a customer or provider…</option>
        <optgroup label="Customers">
          <option v-for="a in pickable.filter(x => x.role === 'customer')" :key="a.id" :value="`customer:${a.id}`">
            {{ a.name }}
          </option>
        </optgroup>
        <optgroup label="Providers">
          <option v-for="a in pickable.filter(x => x.role === 'provider')" :key="a.id" :value="`provider:${a.id}`">
            {{ a.name }}
          </option>
        </optgroup>
      </select>
      <button class="primary small" type="button" :disabled="!picked" @click="startConversation">Open</button>
    </div>

    <div class="inbox-layout">
      <nav class="inbox-list" aria-label="Conversations">
        <p v-if="loading" class="inbox-empty">Loading…</p>
        <p v-else-if="!threads.length" class="inbox-empty">No messages yet.</p>
        <button v-for="thread in threads" :key="keyOf(thread)" type="button"
          :class="{ active: keyOf(thread) === activeKey, unread: thread.unread }" @click="open(thread)">
          <span class="inbox-top">
            <strong>{{ thread.userName }}</strong>
            <span v-if="thread.unread" class="tab-badge">{{ thread.unread }}</span>
          </span>
          <small>{{ thread.userType === 'provider' ? 'Provider' : 'Customer' }} · {{ timeLabel(thread.lastMessageAt)
            }}</small>
          <span class="inbox-preview">{{ preview(thread) }}</span>
        </button>
      </nav>

      <div class="inbox-thread">
        <template v-if="active">
          <div class="inbox-thread-head">
            <strong>{{ active.userName }}</strong>
            <small>{{ active.userType === 'provider' ? 'Provider' : 'Customer' }}</small>
          </div>
          <div ref="listEl" class="inbox-messages" aria-live="polite">
            <p v-if="!messages.length" class="inbox-empty">No messages yet. Write the first one below.</p>
            <div v-for="m in messages" :key="m.id" class="inbox-row" :class="{ mine: m.senderType === 'admin' }">
              <div class="inbox-bubble">
                <p>{{ m.message }}</p>
                <small>{{ m.senderName }} · {{ timeLabel(m.createdAt) }}</small>
              </div>
            </div>
          </div>
          <form class="inbox-composer" @submit.prevent="send">
            <textarea v-model="draft" rows="2" maxlength="2000" :placeholder="`Message ${active.userName}`"
              aria-label="Reply" @keydown="onKeydown"></textarea>
            <button class="primary small" type="submit" :disabled="sending || !draft.trim()">
              {{ sending ? 'Sending…' : 'Send' }}
            </button>
          </form>
        </template>
        <p v-else class="inbox-empty">Choose a conversation, or write to someone using the list above.</p>
      </div>
    </div>
    <p v-if="error" class="error-text" role="alert">{{ error }}</p>
  </section>
</template>

<style scoped>
.inbox-start {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
}

.inbox-start select {
  flex: 1;
  min-width: 0;
  max-width: 420px;
}

.inbox-layout {
  display: grid;
  grid-template-columns: minmax(200px, 280px) minmax(0, 1fr);
  gap: 16px;
}

.inbox-list {
  display: grid;
  gap: 8px;
  align-content: start;
  max-height: 460px;
  overflow-y: auto;
}

.inbox-list button {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 2px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius-md, 12px);
  background: var(--surface);
  color: var(--text);
  text-align: left;
  box-shadow: none;
  cursor: pointer;
}

.inbox-list button.active {
  border-color: var(--brand);
  background: var(--brand-soft);
}

.inbox-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.inbox-top strong,
.inbox-preview {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.inbox-list small,
.inbox-preview {
  color: var(--muted);
  font-size: .82rem;
}

.inbox-list .unread .inbox-preview {
  color: var(--text);
  font-weight: 600;
}

.inbox-thread {
  display: grid;
  gap: 12px;
  align-content: start;
  min-width: 0;
}

.inbox-thread-head {
  display: grid;
}

.inbox-thread-head small {
  color: var(--muted);
}

.inbox-messages {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 320px;
  overflow-y: auto;
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: var(--radius-md, 12px);
  background: var(--bg);
}

.inbox-empty {
  margin: auto;
  padding: 12px;
  color: var(--muted);
  text-align: center;
}

.inbox-row {
  display: flex;
}

.inbox-row.mine {
  justify-content: flex-end;
}

.inbox-bubble {
  max-width: min(78%, 520px);
  padding: 9px 13px;
  border: 1px solid var(--line);
  border-radius: 16px 16px 16px 4px;
  background: var(--surface);
}

.mine .inbox-bubble {
  border-color: var(--brand);
  border-radius: 16px 16px 4px 16px;
  background: var(--brand);
  color: #fff;
}

.inbox-bubble p {
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.inbox-bubble small {
  display: block;
  margin-top: 4px;
  font-size: .72rem;
  opacity: .75;
}

.inbox-composer {
  display: flex;
  gap: 10px;
  align-items: flex-end;
}

.inbox-composer textarea {
  flex: 1;
  min-width: 0;
  resize: vertical;
  font: inherit;
}

@media (max-width: 760px) {
  .inbox-layout {
    grid-template-columns: 1fr;
  }

  .inbox-list {
    max-height: 200px;
  }
}
</style>
