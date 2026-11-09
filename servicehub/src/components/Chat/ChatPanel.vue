<script setup>
// One booking's conversation between the customer and their provider.
// Used on both the customer and provider dashboards.
//
// Chat is gated by an admin: either side asks to open it (emits request-chat),
// an admin approves it, then both can send. There are no websockets, so while
// the panel is open it polls: messages every few seconds once approved, and the
// approval (through the refresh-chat event) while it is waiting on the admin.
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import * as api from '../../services/api'

const props = defineProps({
  // a booking in the shape App.vue's normalizeBooking() produces
  request: { type: Object, required: true },
  // who is looking: 'customer' or 'provider'
  role: { type: String, required: true },
  // this booking's chat approval from GET /chat/approvals, or null
  approval: { type: Object, default: null },
  pollMs: { type: Number, default: 5000 }
})

const emit = defineEmits(['request-chat', 'refresh-chat'])

const MAX_LENGTH = 2000

const messages = ref([])
const draft = ref('')
const sending = ref(false)
const requesting = ref(false)
const error = ref('')
const listEl = ref(null)
let timer = null

const status = computed(() => props.approval?.status || 'not-requested')
const isCancelled = computed(() => props.request.providerStatus === 'declined' || props.request.status === 'cancelled')
const hasProvider = computed(() => Boolean(props.request.providerId || props.request.providerName))
const canRequest = computed(() => hasProvider.value && !isCancelled.value)
const canSend = computed(() => status.value === 'approved' && !isCancelled.value)
const otherParty = computed(() =>
  props.role === 'customer'
    ? props.request.providerName || 'your provider'
    : props.request.customerName || 'the customer'
)

const statusLabel = computed(() => ({
  'not-requested': 'Not opened',
  pending: 'Waiting for admin approval',
  approved: 'Open',
  rejected: 'Closed by admin'
})[status.value] || status.value)

function isMine(message) {
  return message.senderType === props.role
}

function formatTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

async function scrollToBottom() {
  await nextTick()
  if (listEl.value) listEl.value.scrollTop = listEl.value.scrollHeight
}

async function loadMessages() {
  if (!props.request?.id) return
  try {
    const latest = await api.getChatMessages(props.request.id)
    const grew = latest.length !== messages.value.length
    messages.value = latest
    if (grew) scrollToBottom()
  } catch (err) {
    error.value = err.message || 'Could not load messages.'
  }
}

function stopPolling() {
  if (timer) clearInterval(timer)
  timer = null
}

function tick() {
  if (typeof document !== 'undefined' && document.hidden) return
  if (status.value === 'approved') loadMessages()
  else if (status.value === 'pending') emit('refresh-chat')
}

function startPolling() {
  stopPolling()
  if (status.value === 'approved' || status.value === 'pending') {
    timer = setInterval(tick, props.pollMs)
  }
}

// a rejected chat may still have history from before it was closed
function onConversationChange() {
  error.value = ''
  requesting.value = false
  if (status.value === 'approved' || status.value === 'rejected') loadMessages()
  else messages.value = []
  startPolling()
}

watch(() => [props.request?.id, status.value], onConversationChange, { immediate: true })
onBeforeUnmount(stopPolling)

// App.vue sends the request and refreshes the approvals, which flips status
// (and so `requesting`) once the backend answers
function requestChat() {
  if (!canRequest.value || requesting.value) return
  requesting.value = true
  error.value = ''
  emit('request-chat', { requestId: props.request.id })
  setTimeout(() => { requesting.value = false }, 4000)
}

async function send() {
  const text = draft.value.trim()
  if (!text || sending.value || !canSend.value) return
  sending.value = true
  error.value = ''
  try {
    const saved = await api.sendChatMessage({ bookingId: props.request.id, message: text })
    if (saved) messages.value = [...messages.value, saved]
    draft.value = ''
    scrollToBottom()
  } catch (err) {
    error.value = err.message || 'Could not send your message.'
    // the admin may have closed the chat in the meantime
    emit('refresh-chat')
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
</script>

<template>
  <section class="chat-panel" :aria-label="`Chat with ${otherParty}`">
    <header class="chat-header">
      <div>
        <strong>Chat with {{ otherParty }}</strong>
        <small>{{ request.serviceTitle }}</small>
      </div>
      <span class="status-pill chat-status" :class="status">{{ statusLabel }}</span>
    </header>

    <div v-if="!hasProvider" class="chat-notice">
      Chat opens once a provider has been assigned to this request.
    </div>
    <div v-else-if="isCancelled && status !== 'approved' && !messages.length" class="chat-notice">
      Chat is not available on a cancelled request.
    </div>

    <template v-else-if="status === 'not-requested'">
      <div class="chat-notice">
        <p>To keep everyone safe, chat between customers and providers is opened by a ServiceHub admin.</p>
        <button class="primary small" type="button" :disabled="requesting" @click="requestChat">
          {{ requesting ? 'Sending request…' : 'Ask to chat' }}
        </button>
      </div>
    </template>

    <div v-else-if="status === 'pending'" class="chat-notice">
      Your request to chat is waiting for an admin. This updates automatically once it's approved.
    </div>

    <template v-else>
      <div ref="listEl" class="chat-messages" role="log" aria-live="polite">
        <p v-if="!messages.length" class="chat-empty">No messages yet. Say hello to {{ otherParty }}.</p>
        <div v-for="m in messages" :key="m.id" class="chat-bubble-row" :class="{ mine: isMine(m) }">
          <div class="chat-bubble">
            <p>{{ m.message }}</p>
            <small>{{ isMine(m) ? 'You' : otherParty }} · {{ formatTime(m.createdAt) }}</small>
          </div>
        </div>
      </div>

      <form v-if="canSend" class="chat-composer" @submit.prevent="send">
        <textarea v-model="draft" rows="2" :maxlength="MAX_LENGTH" :placeholder="`Message ${otherParty}`"
          aria-label="Message" @keydown="onKeydown" />
        <button class="primary small" type="submit" :disabled="sending || !draft.trim()">
          {{ sending ? 'Sending…' : 'Send' }}
        </button>
      </form>
      <div v-else-if="status === 'rejected'" class="chat-notice">
        An admin has closed this chat.
        <button v-if="canRequest" class="secondary small" type="button" :disabled="requesting" @click="requestChat">
          Ask again
        </button>
      </div>
    </template>

    <p v-if="error" class="error-text chat-error">{{ error }}</p>
  </section>
</template>

<style scoped>
.chat-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.chat-header div {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.chat-header small {
  color: var(--muted);
}

.chat-status {
  white-space: nowrap;
}

.chat-notice {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  padding: 16px;
  border: 1px dashed var(--line-strong);
  border-radius: var(--radius-md);
  background: var(--surface-2);
  color: var(--muted);
}

.chat-notice p {
  margin: 0;
}

.chat-messages {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 340px;
  overflow-y: auto;
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: var(--surface-2);
}

.chat-empty {
  margin: auto;
  color: var(--muted);
  text-align: center;
}

.chat-bubble-row {
  display: flex;
}

.chat-bubble-row.mine {
  justify-content: flex-end;
}

.chat-bubble {
  max-width: min(78%, 520px);
  padding: 10px 14px;
  border-radius: 16px 16px 16px 4px;
  background: var(--surface);
  border: 1px solid var(--line);
  color: var(--text);
}

.mine .chat-bubble {
  border-radius: 16px 16px 4px 16px;
  border-color: transparent;
  background: var(--brand);
  color: #fff;
}

.chat-bubble p {
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.chat-bubble small {
  display: block;
  margin-top: 4px;
  font-size: 0.75rem;
  opacity: 0.75;
}

.chat-composer {
  display: flex;
  gap: 10px;
  align-items: flex-end;
}

.chat-composer textarea {
  flex: 1;
  min-width: 0;
  min-height: 48px;
  height: 56px;
  max-height: 160px;
  resize: vertical;
}

.chat-error {
  margin: 0;
}
</style>
