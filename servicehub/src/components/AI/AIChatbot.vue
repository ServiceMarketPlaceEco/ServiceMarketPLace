<script setup>
// Vue utilities for reactive state, calculated data and automatic scrolling.
import { nextTick, ref } from 'vue'
import * as api from '../../services/api'

// Interface state.
const open = ref(false)
const input = ref('')
const loading = ref(false)
const messagesContainer = ref(null)

// Messages displayed in the conversation.
const messages = ref([
  {
    role: 'assistant',
    text: 'Hi! I am the ServiceHub AI assistant. Ask me about services, booking, provider approval or request tracking.',
  },
])

// Scroll to the newest message after Vue updates the page.
async function scrollToBottom() {
  await nextTick()

  if (messagesContainer.value) {
    messagesContainer.value.scrollTop =
      messagesContainer.value.scrollHeight
  }
}

// Send a message to the backend AI endpoint and display its reply.
async function sendMessage() {
  const text = input.value.trim()

  // Prevent empty and duplicate submissions.
  if (!text || loading.value) return

  // Limit history so requests do not grow indefinitely, and match the
  // backend's expected shape ({ role, content }).
  const previousHistory = messages.value
    .slice(-8)
    .map((entry) => ({ role: entry.role, content: entry.text }))

  // Display the user's message immediately.
  messages.value.push({ role: 'user', text })
  input.value = ''
  loading.value = true
  await scrollToBottom()

  try {
    const { reply } = await api.sendChatbotMessage(text, previousHistory)
    messages.value.push({ role: 'assistant', text: reply })
  } catch (error) {
    console.error('ServiceHub assistant request failed:', error)
    messages.value.push({
      role: 'assistant',
      text: 'The assistant is temporarily unavailable. Please try again shortly.',
    })
  }
  loading.value = false
  await scrollToBottom()
}

// Submit a suggested question when a quick-action button is selected.
function sendQuickMessage(text) {
  if (loading.value) return
  input.value = text
  sendMessage()
}
</script>

<template>
  <aside class="ai-assistant">
    <!-- Floating button that opens and closes the chatbot panel. -->
    <button class="ai-fab" type="button" aria-label="Open ServiceHub AI assistant" @click="open = !open">
      AI Help
    </button>

    <section v-if="open" class="ai-panel" aria-label="ServiceHub AI assistant">
      <header class="ai-panel-header">
        <div>
          <strong>ServiceHub Assistant</strong>
          <small>AI-powered ServiceHub support</small>
        </div>

        <button class="icon-close" type="button" aria-label="Close chatbot" @click="open = false">
          ×
        </button>
      </header>

      <!-- aria-live announces new replies to screen-reader users. -->
      <div ref="messagesContainer" class="ai-messages" aria-live="polite">
        <p v-for="(message, index) in messages" :key="index" class="ai-message" :class="message.role">
          {{ message.text }}
        </p>

        <!-- Shown while waiting for the backend. -->
        <p v-if="loading" class="ai-message assistant loading-message">
          AI is thinking...
        </p>
      </div>

      <!-- Suggested questions show users what the assistant can answer. -->
      <div class="ai-quick-actions">
        <button type="button" :disabled="loading" @click="sendQuickMessage('How do I book a service?')">
          Book service
        </button>
        <button type="button" :disabled="loading" @click="sendQuickMessage('How does provider approval work?')">
          Provider approval
        </button>
        <button type="button" :disabled="loading" @click="sendQuickMessage('How do I track my request?')">
          Tracking
        </button>
      </div>

      <!-- .prevent submits without refreshing the browser. -->
      <form class="ai-compose" @submit.prevent="sendMessage">
        <input v-model="input" type="text" maxlength="1000" placeholder="Ask anything about ServiceHub..."
          aria-label="Chatbot message" :disabled="loading" />
        <button class="primary small" type="submit" :disabled="loading || !input.trim()">
          {{ loading ? 'Sending...' : 'Send' }}
        </button>
      </form>
    </section>
  </aside>
</template>

<style scoped>
/* Animate the waiting message while the backend prepares its response. */
.loading-message {
  animation: chatbot-pulse 1.2s infinite;
}

/* Make unavailable controls visually clear. */
.ai-compose button:disabled,
.ai-compose input:disabled,
.ai-quick-actions button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

@keyframes chatbot-pulse {

  0%,
  100% {
    opacity: 0.45;
  }

  50% {
    opacity: 1;
  }
}
</style>
