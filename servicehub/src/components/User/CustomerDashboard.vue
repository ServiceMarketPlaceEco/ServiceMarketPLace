<script setup>
import { ref } from 'vue'
import { formatStatus } from '../../data/services'
import ChatPanel from '../Chat/ChatPanel.vue'
import { useUnreadChats } from '../../composables/useUnreadChats'

defineProps({
  customer: Object,
  requests: {
    type: Array,
    default: () => []
  }
})

defineEmits(['request-another', 'view-tracking'])

const activeTab = ref('requests')
const focusBookingId = ref('')
const { unread, setUnread } = useUnreadChats()

// a customer can message the provider once an admin has assigned one
function canMessage(request) {
  return Boolean(request.providerName) && request.status !== 'waiting-admin-approval'
}

function messageProvider(request) {
  focusBookingId.value = request.id
  activeTab.value = 'messages'
}

function openMessages() {
  focusBookingId.value = ''
  activeTab.value = 'messages'
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
      <button :class="{ active: activeTab === 'messages' }" @click="openMessages">
        Messages <span v-if="unread" class="tab-badge">{{ unread }}</span>
      </button>
    </div>

    <ChatPanel v-if="activeTab === 'messages'" role="customer" :focus-booking-id="focusBookingId"
      @unread="setUnread" />

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
              <th>Actions</th>
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
              <td class="row-actions">
                <button class="secondary small" @click="$emit('view-tracking', request)">Track</button>
                <button v-if="canMessage(request)" class="primary small" @click="messageProvider(request)">Message</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>
