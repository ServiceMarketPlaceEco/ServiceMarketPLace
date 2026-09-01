<script setup>
// Vue utilities for reactive state, calculated data and automatic scrolling.
import { computed, nextTick, ref } from 'vue'

// TEMPORARY FRONTEND-ONLY TESTING SWITCH:
// Keep this set to true while no backend is available.
// Change it to false when the real POST /api/ai-chat endpoint is ready.
const USE_MOCK_AI = true

// Data passed into the chatbot by its parent component.
const props = defineProps({
  signedInUser: { type: Object, default: null },
  requests: { type: Array, default: () => [] },
  services: { type: Array, default: () => [] },
})

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

// Select only the requests relevant to the signed-in user's role.
const userRequests = computed(() => {
  if (!props.signedInUser?.id) return []

  if (props.signedInUser.role === 'customer') {
    return props.requests.filter(
      (request) => request.customerId === props.signedInUser.id,
    )
  }

  if (props.signedInUser.role === 'provider') {
    return props.requests.filter(
      (request) => request.providerId === props.signedInUser.id,
    )
  }

  return props.signedInUser.role === 'admin' ? props.requests : []
})

// Provide the backend with a small, non-sensitive ServiceHub summary.
// The backend must still authenticate users and enforce permissions.
const chatbotContext = computed(() => ({
  userRole: props.signedInUser?.role ?? 'guest',
  requestCount: userRequests.value.length,
  requestStatuses: userRequests.value
    .map((request) => request.status)
    .filter(Boolean)
    .slice(0, 10),
  services: props.services.slice(0, 20).map((service) => ({
    title: service.title,
    category: service.category,
    price: Number(service.price),
  })),
}))

// Scroll to the newest message after Vue updates the page.
async function scrollToBottom() {
  await nextTick()

  if (messagesContainer.value) {
    messagesContainer.value.scrollTop =
      messagesContainer.value.scrollHeight
  }
}

// TEMPORARY MOCK AI:
// Simulates a backend response so the complete chatbot interface can be tested.
// This is keyword-based sample data, not a real artificial-intelligence service.
async function getMockAIReply(message) {
  // Simulate the time normally required for a backend request.
  await new Promise((resolve) => setTimeout(resolve, 800))

  const question = message.toLowerCase()

  // Word boundaries prevent "hi" from accidentally matching words like "this".
  if (/\b(hello|hi|hey)\b/.test(question)) {
    return 'Hello! I can help with ServiceHub bookings, tracking, providers and services.'
  }

  if (
    question.includes('book') ||
    question.includes('request service')
  ) {
    return 'To book a service, choose a service card, press Request Service, complete the request form and submit it.'
  }

  if (
    question.includes('track') ||
    question.includes('status')
  ) {
    return userRequests.value.length > 0
      ? `You currently have ${userRequests.value.length} visible service request(s). Open your dashboard to view their progress.`
      : 'You do not currently have any visible requests. Submitted requests will appear in your dashboard.'
  }

  if (
    question.includes('provider') ||
    question.includes('approval')
  ) {
    return 'Providers register first and wait for administrator approval. Once approved, they can sign in and manage assigned requests.'
  }

  if (question.includes('admin')) {
    return 'Administrators can approve providers, assign service requests, manage users and approve customer-provider chat access.'
  }

  if (
    question.includes('price') ||
    question.includes('cost') ||
    question.includes('bdt')
  ) {
    return 'Starting prices are displayed in BDT on each ServiceHub service card.'
  }

  if (question.includes('service')) {
    return props.services.length > 0
      ? `ServiceHub currently displays ${props.services.length} service option(s). Select a service card to view its details.`
      : 'ServiceHub provides service categories that customers can browse and request.'
  }

  return `This is a temporary frontend response to: "${message}". A real AI response will be supplied when the backend is connected.`
}

// Send a message to the backend AI endpoint and display its reply.
async function sendMessage() {
  const text = input.value.trim()

  // Prevent empty and duplicate submissions.
  if (!text || loading.value) return

  // Limit history so requests do not grow indefinitely.
  const previousHistory = messages.value.slice(-8)

  // Display the user's message immediately.
  messages.value.push({ role: 'user', text })
  input.value = ''
  loading.value = true
  await scrollToBottom()

  try {
    let assistantReply

    if (USE_MOCK_AI) {
      // Frontend-only mode: generate a simulated reply without a backend.
      assistantReply = await getMockAIReply(text)
    } else {
      // Real mode: Vite can proxy this URL to the NestJS backend.
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: previousHistory,
          context: chatbotContext.value,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'The chatbot request failed.')
      }

      // The real backend should return: { reply: 'AI response' }.
      if (!data.reply) {
        throw new Error('The backend did not return an AI reply.')
      }

      assistantReply = data.reply
    }

    // Both mock mode and real mode display replies in the same interface.
    messages.value.push({ role: 'assistant', text: assistantReply })
  } catch (error) {
    // Keep technical details in the console and show users a friendly message.
    console.error('ServiceHub chatbot error:', error)
    messages.value.push({
      role: 'assistant',
      text: 'Sorry, the AI assistant is unavailable right now. Please try again shortly.',
    })
  } finally {
    // Always restore the form, whether the request succeeds or fails.
    loading.value = false
    await scrollToBottom()
  }
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
    <button
      class="ai-fab"
      type="button"
      aria-label="Open ServiceHub AI assistant"
      @click="open = !open"
    >
      AI Help
    </button>

    <section v-if="open" class="ai-panel" aria-label="ServiceHub AI assistant">
      <header class="ai-panel-header">
        <div>
          <strong>ServiceHub Assistant</strong>
          <small>AI-powered ServiceHub support</small>
        </div>

        <button
          class="icon-close"
          type="button"
          aria-label="Close chatbot"
          @click="open = false"
        >
          ×
        </button>
      </header>

      <!-- aria-live announces new replies to screen-reader users. -->
      <div
        ref="messagesContainer"
        class="ai-messages"
        aria-live="polite"
      >
        <p
          v-for="(message, index) in messages"
          :key="index"
          class="ai-message"
          :class="message.role"
        >
          {{ message.text }}
        </p>

        <!-- Shown while waiting for the backend. -->
        <p v-if="loading" class="ai-message assistant loading-message">
          AI is thinking...
        </p>
      </div>

      <!-- Suggested questions show users what the assistant can answer. -->
      <div class="ai-quick-actions">
        <button
          type="button"
          :disabled="loading"
          @click="sendQuickMessage('How do I book a service?')"
        >
          Book service
        </button>
        <button
          type="button"
          :disabled="loading"
          @click="sendQuickMessage('How does provider approval work?')"
        >
          Provider approval
        </button>
        <button
          type="button"
          :disabled="loading"
          @click="sendQuickMessage('How do I track my request?')"
        >
          Tracking
        </button>
      </div>

      <!-- .prevent submits without refreshing the browser. -->
      <form class="ai-compose" @submit.prevent="sendMessage">
        <input
          v-model="input"
          type="text"
          maxlength="1000"
          placeholder="Ask anything about ServiceHub..."
          aria-label="Chatbot message"
          :disabled="loading"
        />
        <button
          class="primary small"
          type="submit"
          :disabled="loading || !input.trim()"
        >
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
