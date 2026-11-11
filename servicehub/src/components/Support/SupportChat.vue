<script setup>
// A customer's or provider's conversation with the ServiceHub admin team.
// It is separate from the booking chat (Chat/ChatPanel.vue), which is between
// a customer and their provider and needs an admin to open it. This one is
// always open, because one side is an admin.
//
// There are no websockets, so while it is on screen it checks for new
// messages every few seconds.
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import * as api from '../../services/api'

const REFRESH_MS = 5000

const props = defineProps({
  // 'customer' or 'provider': whose messages sit on the right
  role: { type: String, required: true }
})

const emit = defineEmits(['read'])

const messages = ref([])
const draft = ref('')
const loading = ref(true)
const sending = ref(false)
const error = ref('')
const listEl = ref(null)
let timer = null
let busy = false

async function scrollToBottom() {
  await nextTick()
  if (listEl.value) listEl.value.scrollTop = listEl.value.scrollHeight
}

async function load(first = false) {
  if (busy || (!first && document.hidden)) return
  busy = true
  try {
    const fresh = await api.getSupportMessages()
    const grew = fresh.length !== messages.value.length
    messages.value = fresh
    error.value = ''
    // opening the conversation marks it read on the server
    emit('read')
    if (first || grew) await scrollToBottom()
  } catch (err) {
    error.value = err.message || 'Could not load your messages.'
  } finally {
    busy = false
    loading.value = false
  }
}

async function send() {
  const text = draft.value.trim()
  if (!text || sending.value) return
  sending.value = true
  error.value = ''
  try {
    const saved = await api.sendSupportMessage(text)
    messages.value = [...messages.value, saved]
    draft.value = ''
    await scrollToBottom()
  } catch (err) {
    // the draft stays so nothing has to be typed again
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

function isMine(message) {
  return message.senderType === props.role
}

function timeLabel(value) {
  if (!value) return ''
  return new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

onMounted(() => {
  load(true)
  timer = window.setInterval(load, REFRESH_MS)
})

onBeforeUnmount(() => window.clearInterval(timer))
</script>

<template>
  <div class="support-chat">
    <div class="support-header">
      <div>
        <strong>ServiceHub admin team</strong>
        <small>Ask about a booking, a provider or your account. We usually reply within a day.</small>
      </div>
    </div>

    <div ref="listEl" class="support-messages" aria-live="polite">
      <p v-if="loading" class="support-empty">Loading messages…</p>
      <p v-else-if="!messages.length" class="support-empty">No messages yet. Write to the admin team below.</p>
      <div v-for="m in messages" :key="m.id" class="support-row" :class="{ mine: isMine(m) }">
        <div class="support-bubble">
          <p>{{ m.message }}</p>
          <small>{{ isMine(m) ? 'You' : 'ServiceHub admin' }} · {{ timeLabel(m.createdAt) }}</small>
        </div>
      </div>
    </div>

    <form class="support-composer" @submit.prevent="send">
      <textarea v-model="draft" rows="2" maxlength="2000" placeholder="Message the admin team"
        aria-label="Message the admin team" @keydown="onKeydown"></textarea>
      <button class="primary small" type="submit" :disabled="sending || !draft.trim()">
        {{ sending ? 'Sending…' : 'Send' }}
      </button>
    </form>
    <p v-if="error" class="support-error" role="alert">{{ error }}</p>
  </div>
</template>

<style scoped>
.support-chat {
  display: grid;
  gap: 12px;
}

.support-header div {
  display: grid;
}

.support-header small {
  color: var(--muted);
}

.support-messages {
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

.support-empty {
  margin: auto;
  color: var(--muted);
  text-align: center;
}

.support-row {
  display: flex;
}

.support-row.mine {
  justify-content: flex-end;
}

.support-bubble {
  max-width: min(78%, 520px);
  padding: 9px 13px;
  border: 1px solid var(--line);
  border-radius: 16px 16px 16px 4px;
  background: var(--surface);
}

.mine .support-bubble {
  border-color: var(--brand);
  border-radius: 16px 16px 4px 16px;
  background: var(--brand);
  color: #fff;
}

.support-bubble p {
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.support-bubble small {
  display: block;
  margin-top: 4px;
  font-size: .72rem;
  opacity: .75;
}

.support-composer {
  display: flex;
  gap: 10px;
  align-items: flex-end;
}

.support-composer textarea {
  flex: 1;
  min-width: 0;
  resize: vertical;
  font: inherit;
}

.support-error {
  margin: 0;
  color: var(--danger);
  font-size: .85rem;
}
</style>
