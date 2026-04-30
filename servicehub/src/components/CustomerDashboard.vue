<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  requests: { type: Array, default: () => [] },
  userName: { type: String, default: 'Customer' }
})

const emit = defineEmits(['new-request', 'write-review', 'block-helper'])
const modal = ref(null)
const selectedRequest = ref(null)
const reviewText = ref('')
const blockReason = ref('')

const pendingCount = computed(() => props.requests.filter(r => r.status === 'Pending').length)
const acceptedCount = computed(() => props.requests.filter(r => r.status === 'Accepted').length)
const completedCount = computed(() => props.requests.filter(r => r.status === 'Completed').length)

function openReview(request) {
  selectedRequest.value = request
  reviewText.value = ''
  modal.value = 'review'
}

function openBlock(request) {
  selectedRequest.value = request
  blockReason.value = ''
  modal.value = 'block'
}

function submitReview() {
  if (!reviewText.value.trim()) return alert('Please write your review first.')
  emit('write-review', {
    requestId: selectedRequest.value.id,
    service: selectedRequest.value.service,
    provider: selectedRequest.value.provider,
    review: reviewText.value
  })
  modal.value = null
}

function submitBlock() {
  if (!blockReason.value.trim()) return alert('Please explain why this helper should be reviewed.')
  emit('block-helper', {
    requestId: selectedRequest.value.id,
    service: selectedRequest.value.service,
    provider: selectedRequest.value.provider,
    reason: blockReason.value
  })
  modal.value = null
}
</script>

<template>
  <section class="customer-dashboard">
    <aside class="customer-sidebar">
      <div class="dash-brand"><span class="logo small">S</span><strong>Service Hub</strong></div>

      <div class="side-profile">
        <span class="avatar">{{ userName.charAt(0).toUpperCase() }}</span>
        <div>
          <p>Signed in as</p>
          <strong>{{ userName }}</strong>
        </div>
      </div>

      <nav class="side-nav" aria-label="Dashboard menu">
        <button class="side-item active">My requests</button>
        <button class="side-item" @click="$emit('new-request')">New request</button>
      </nav>

      <div class="security-note">
        <strong>Private history</strong>
        <p>Only requests created by this account appear here.</p>
      </div>
    </aside>

    <div class="customer-main">
      <header class="customer-topbar">
        <div>
          <p class="eyebrow">Welcome back</p>
          <h1>{{ userName }} Dashboard</h1>
          <p>Track your service requests, review completed jobs, and report helper issues.</p>
        </div>
        <button class="primary" @click="$emit('new-request')">New Request</button>
      </header>

      <section class="dashboard-hero-card">
        <div>
          <h2>Secure customer dashboard</h2>
          <p>Your request history is account-protected. Guests cannot view dashboard history.</p>
        </div>
        <div class="secure-badge">Account protected</div>
      </section>

      <section class="metric-grid">
        <article>
          <span>Total requests</span>
          <strong>{{ props.requests.length }}</strong>
        </article>
        <article>
          <span>Pending</span>
          <strong>{{ pendingCount }}</strong>
        </article>
        <article>
          <span>Accepted</span>
          <strong>{{ acceptedCount }}</strong>
        </article>
        <article>
          <span>Completed</span>
          <strong>{{ completedCount }}</strong>
        </article>
      </section>

      <section class="request-card">
        <div class="request-card-head">
          <div>
            <h2>My service requests</h2>
            <p>Manage only the requests connected to your signed-in account.</p>
          </div>
        </div>

        <div v-if="!props.requests.length" class="empty-dashboard-card">
          <div class="empty-icon">＋</div>
          <h3>No request history yet</h3>
          <p>Create your first request to see tracking, review, and block options here.</p>
          <button class="primary compact" @click="$emit('new-request')">Create your first request</button>
        </div>

        <div v-else class="request-table-wrap">
          <table class="dashboard-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Service</th>
                <th>Provider</th>
                <th>Area</th>
                <th>Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="request in props.requests" :key="request.id">
                <td>{{ request.id }}</td>
                <td><strong>{{ request.service }}</strong></td>
                <td>{{ request.provider }}</td>
                <td>{{ request.area }}</td>
                <td>{{ request.date }}</td>
                <td><span class="status-pill">{{ request.status }}</span></td>
                <td>
                  <div class="row-actions">
                    <button @click="openReview(request)">Review</button>
                    <button @click="openBlock(request)">Block</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <div v-if="modal" class="modal-overlay">
      <div class="action-modal">
        <button class="modal-x" @click="modal = null">×</button>
        <p class="eyebrow">Customer action</p>
        <h2>{{ modal === 'review' ? 'Write a review' : 'Request helper block' }}</h2>
        <p class="muted-text">{{ selectedRequest?.service }} · {{ selectedRequest?.provider }}</p>
        <textarea v-if="modal === 'review'" v-model="reviewText" rows="5" placeholder="Write your service experience"></textarea>
        <textarea v-else v-model="blockReason" rows="5" placeholder="Explain the safety or quality issue"></textarea>
        <button class="primary full" @click="modal === 'review' ? submitReview() : submitBlock()">Submit</button>
      </div>
    </div>
  </section>
</template>
