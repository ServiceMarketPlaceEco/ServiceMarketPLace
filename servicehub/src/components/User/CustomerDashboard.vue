<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { formatStatus } from '../../data/services'
import * as api from '../../services/api'
import ChatPanel from '../Chat/ChatPanel.vue'
import SupportChat from '../Support/SupportChat.vue'
import CustomerSettings from './CustomerSettings.vue'

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

defineEmits(['request-another', 'view-tracking', 'request-chat', 'refresh-chat', 'profile-updated', 'account-closed'])

// 'requests', 'admin' (messages with the admin team) or 'settings'
const activeTab = ref('requests')

// unread messages from the admin team, shown on the tab. checked every 20
// seconds; a failed check just keeps the old number
const adminUnread = ref(0)
let unreadTimer = null
async function checkAdminUnread() {
  if (document.hidden) return
  try {
    adminUnread.value = await api.getSupportUnread()
  } catch {
    // the badge is a nice-to-have
  }
}
onMounted(() => {
  checkAdminUnread()
  unreadTimer = window.setInterval(checkAdminUnread, 20000)
})
onBeforeUnmount(() => window.clearInterval(unreadTimer))

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

    <div class="moderation-tabs">
      <button :class="{ active: activeTab === 'requests' }" @click="activeTab = 'requests'">My requests</button>
      <button :class="{ active: activeTab === 'admin' }" @click="activeTab = 'admin'">
        Message admin<span v-if="adminUnread" class="tab-badge">{{ adminUnread }}</span>
      </button>
      <button :class="{ active: activeTab === 'settings' }" @click="activeTab = 'settings'">Settings</button>
    </div>

    <div v-if="activeTab === 'admin'" class="table-card clean-card customer-admin-chat">
      <SupportChat role="customer" @read="adminUnread = 0" />
    </div>

    <CustomerSettings v-else-if="activeTab === 'settings'" :customer="customer"
      @profile-updated="$emit('profile-updated', $event)" @account-closed="$emit('account-closed')" />

    <div v-else-if="!requests.length" class="empty-state">
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
              <td>{{ request.preferredDate || request.createdAt }}<small v-if="request.preferredTime">{{
                request.preferredTime }}</small></td>
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

    <div v-if="chatRequest && activeTab === 'requests'" ref="chatSection" class="table-card clean-card customer-chat">
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
.customer-admin-chat {
  padding: 24px;
  /* room so the floating AI Help button doesn't sit on top of Send */
  margin-bottom: 88px;
}

.customer-chat {
  margin-top: 20px;
  /* room so the floating AI Help button doesn't sit on top of Send */
  margin-bottom: 88px;
}
</style>
