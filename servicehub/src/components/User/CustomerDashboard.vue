<script setup>
import { computed, nextTick, ref } from 'vue'
import { formatStatus } from '../../data/services'
import ChatPanel from '../Chat/ChatPanel.vue'

const props = defineProps({
  customer: Object,
  requests: {
    type: Array,
    default: () => []
  },
  chatApprovals: {
    type: Array,
    default: () => []
  }
})

defineEmits(['request-another', 'view-tracking', 'request-chat', 'refresh-chat'])

const chatRequestId = ref(null)
const chatSection = ref(null)
const chatRequest = computed(() => props.requests.find(r => r.id === chatRequestId.value) || null)
const chatApproval = computed(() => props.chatApprovals.find(a => a.requestId === chatRequestId.value) || null)

function approvalFor(request) {
  return props.chatApprovals.find(a => a.requestId === request.id)
}

async function openChat(request) {
  chatRequestId.value = request.id
  await nextTick()
  chatSection.value?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <section class="page-section">
    <div class="dashboard-hero clean-card">
      <div>
        <p class="eyebrow">Customer dashboard</p>
        <h2>Welcome, {{ customer?.name }}</h2>
        <p class="muted">View previous requests, track progress, and request another Rajshahi service.</p>
      </div>

      <button class="primary" @click="$emit('request-another')">
        Request another service
      </button>
    </div>

    <div v-if="!requests.length" class="empty-state">
      No service requests yet.
    </div>

    <div v-else class="table-card clean-card">
      <div class="panel-heading">
        <h3>Previous requests</h3>
      </div>

      <div class="responsive-table">
        <table>
          <thead>
            <tr>
              <th>Service</th>
              <th>Location</th>
              <th>Date</th>
              <th>Provider</th>
              <th>Status</th>
              <th>Tracking</th>
              <th>Chat</th>
            </tr>
          </thead>

          <tbody>
            <tr v-for="request in requests" :key="request.id">
              <td>
                <strong>{{ request.serviceTitle }}</strong>
                <small>{{ request.details }}</small>
              </td>
              <td>{{ request.location || request.customerLocation || 'Rajshahi' }}</td>
              <td>{{ request.preferredDate || request.createdAt }}</td>
              <td>
                <strong v-if="request.providerName">{{ request.providerName }}</strong>
                <small v-if="request.providerPhone">{{ request.providerPhone }}</small>
                <span v-if="!request.providerName" class="muted">Not assigned yet</span>
              </td>
              <td>
                <span class="status-pill" :class="request.status">{{ formatStatus(request.status) }}</span>
              </td>
              <td>
                <button class="secondary small" @click="$emit('view-tracking', request)">Track</button>
              </td>
              <td>
                <button class="secondary small chat-open" :disabled="!request.providerName"
                  :title="request.providerName ? '' : 'Chat opens once a provider is assigned'"
                  @click="openChat(request)">
                  {{ approvalFor(request)?.status === 'approved' ? 'Open chat' : 'Chat' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="chatRequest" ref="chatSection" class="table-card clean-card customer-chat">
      <div class="panel-heading">
        <h3>Messages</h3>
        <button class="secondary small" type="button" @click="chatRequestId = null">Close</button>
      </div>
      <ChatPanel :request="chatRequest" role="customer" :approval="chatApproval"
        @request-chat="$emit('request-chat', $event)" @refresh-chat="$emit('refresh-chat')" />
    </div>
  </section>
</template>

<style scoped>
.customer-chat {
  margin-top: 20px;
  /* room so the floating AI Help button doesn't sit on top of Send */
  margin-bottom: 88px;
}
</style>
