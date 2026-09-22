<script setup>
// Real AI assistant backed by POST /chatbot/message (OpenAI). Falls back to local
// keyword matching if the backend assistant isn't configured or unreachable.
import { computed, ref } from 'vue'
import * as api from '../../services/api'

const props = defineProps({
    signedInUser: { type: Object, default: null },
    requests: { type: Array, default: () => [] },
    services: { type: Array, default: () => [] }
})

const open = ref(false)
const input = ref('')
const sending = ref(false)
const messages = ref([
    { role: 'assistant', text: 'Hi, I am the ServiceHub assistant. Ask me about services, login, tracking, provider approval, admin workflow, or your request status.' }
])

const userRequests = computed(() => {
    if (!props.signedInUser?.id) return []
    if (props.signedInUser.role === 'customer') return props.requests.filter(request => request.customerId === props.signedInUser.id)
    if (props.signedInUser.role === 'provider') return props.requests.filter(request => request.providerId === props.signedInUser.id)
    return props.requests
})

function answerFor(text) {
    const q = text.toLowerCase()
    const serviceMatch = props.services.find(service => q.includes(service.title.toLowerCase()) || q.includes(service.category.toLowerCase()))

    if (['hi', 'hello', 'hey'].some(word => q.includes(word))) return 'Hi! I can help you find a service, explain the booking flow, or guide you through dashboard actions.'
    if (q.includes('price') || q.includes('cost') || q.includes('bdt')) return serviceMatch ? `${serviceMatch.title} starts from BDT ${Number(serviceMatch.price).toLocaleString()}.` : 'Most service cards show a starting price in BDT. Search by service name to compare options.'
    if (q.includes('track') || q.includes('status')) return userRequests.value.length ? `You have ${userRequests.value.length} visible request(s). Open your dashboard and use Track or View tracking demo for the progress screen.` : 'After you submit a request, tracking appears in your customer dashboard.'
    if (q.includes('provider')) return 'Providers apply first, then admin approves the account. After approval, providers can sign in, accept assigned requests, update job status and request chat approval.'
    if (q.includes('admin')) return 'Admin can approve providers, assign requests, approve chat, review users, and reset the local demo database from the admin dashboard.'
    if (q.includes('login') || q.includes('sign')) return 'Customers sign in with name or phone. Providers use their provider ID. Demo admin login is admin01 / admin123.'
    if (q.includes('chat') || q.includes('message')) return 'Chat is controlled by admin approval. A provider can request chat access, then admin approves or rejects it.'
    if (q.includes('request') || q.includes('book')) return 'To book, search for a service, press Request service, complete the request form, then monitor it from your dashboard.'
    if (serviceMatch) return `${serviceMatch.title} is available under ${serviceMatch.category}. It starts from BDT ${Number(serviceMatch.price).toLocaleString()} and can be requested from the service card.`
    if (q.includes('thank')) return 'You are welcome. I am here if you need help.'
    if (q.includes('help')) return 'I can assist with any questions then make sure that our Admin can get in touch with you.'

    return 'I can help with ServiceHub services, pricing, booking, dashboard navigation, provider approval, admin assignment and request tracking. Try asking about one of those areas.'
}

async function sendMessage() {
    const text = input.value.trim()
    if (!text || sending.value) return

    const history = messages.value.slice(-10).map(m => ({ role: m.role, content: m.text }))
    messages.value.push({ role: 'user', text })
    input.value = ''
    sending.value = true

    try {
        const { reply } = await api.sendChatbotMessage(text, history)
        messages.value.push({ role: 'assistant', text: reply })
    } catch (err) {
        // AI backend not configured yet or unreachable: fall back to local keyword answers
        messages.value.push({ role: 'assistant', text: answerFor(text) })
    } finally {
        sending.value = false
    }
}
</script>

<template>
    <aside class="ai-assistant">
        <button class="ai-fab" @click="open = !open">AI help</button>
        <section v-if="open" class="ai-panel">
            <header class="ai-panel-header">
                <div><strong>ServiceHub assistant</strong><small>front-end prototype support</small></div>
                <button class="icon-close" @click="open = false">×</button>
            </header>
            <div class="ai-messages">
                <p v-for="(message, index) in messages" :key="index" class="ai-message" :class="message.role">{{
                    message.text }}</p>
            </div>
            <div class="ai-quick-actions">
                <button @click="input = 'How do I book a service?'; sendMessage()">Book service</button>
                <button @click="input = 'How does provider approval work?'; sendMessage()">Provider approval</button>
                <button @click="input = 'How do I track my request?'; sendMessage()">Tracking</button>
            </div>
            <form class="ai-compose" @submit.prevent="sendMessage">
                <input v-model="input" placeholder="Ask anything about ServiceHub..." :disabled="sending" />
                <button class="primary small" type="submit" :disabled="sending">{{ sending ? '...' : 'Send' }}</button>
            </form>
        </section>
    </aside>
</template>
