<script setup>
// Customer dashboard component: shows customer request status and lets a real signed-in customer request a provider block.
import { reactive, ref } from 'vue'

const props = defineProps({
  requests: { type: Array, default: () => [] },
  userName: { type: String, default: 'Customer' }
})

const emit = defineEmits(['new-request', 'block-request'])
const showBlockForm = ref(false)
const blockForm = reactive({ targetName: '', reason: '' })

function submitBlockRequest() {
  if (!blockForm.targetName.trim() || !blockForm.reason.trim()) return
  emit('block-request', { targetName: blockForm.targetName, targetRole: 'provider', reason: blockForm.reason })
  blockForm.targetName = ''
  blockForm.reason = ''
  showBlockForm.value = false
}
</script>

<template>
  <section class="page-section dashboard-page">
    <div class="dashboard-hero clean-card">
      <div>
        <p class="eyebrow">Customer dashboard</p>
        <h2>Welcome back, {{ userName }}</h2>
        <p>Track your own service requests, create a new task and report/block a provider when needed.</p>
      </div>
      <div class="row-actions">
        <button class="secondary" @click="showBlockForm = true">Request provider block</button>
        <button class="primary" @click="$emit('new-request')">New request</button>
      </div>
    </div>

    <div class="stat-grid three">
      <article class="stat-card clean-card"><span>Total requests</span><strong>{{ requests.length }}</strong></article>
      <article class="stat-card clean-card"><span>Pending</span><strong>{{requests.filter(r => r.status ===
        'Pending').length }}</strong></article>
      <article class="stat-card clean-card"><span>Accepted</span><strong>{{requests.filter(r => r.status ===
        'Accepted').length }}</strong></article>
    </div>

    <section class="clean-card table-card">
      <div class="panel-heading">
        <h3>Request history</h3><button class="secondary small" @click="$emit('new-request')">Create request</button>
      </div>
      <div v-if="requests.length === 0" class="empty-state">No request history yet. Create your first service request.
      </div>
      <div v-else class="responsive-table">
        <table>
          <thead>
            <tr>
              <th>Request</th>
              <th>Provider</th>
              <th>Location</th>
              <th>Schedule</th>
              <th>Budget</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="request in requests" :key="request.id">
              <td><strong>{{ request.serviceTitle }}</strong><small>{{ request.task }}</small></td>
              <td>{{ request.provider }}</td>
              <td>{{ request.area }}, {{ request.city }}</td>
              <td>{{ request.date }} · {{ request.time }}</td>
              <td>৳{{ request.total }}</td>
              <td><span class="status-pill" :class="request.status.toLowerCase().replace(' ', '-')">{{ request.status
                  }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-if="showBlockForm" class="modal-backdrop" @click.self="showBlockForm = false">
      <form class="modal-card clean-card" @submit.prevent="submitBlockRequest">
        <button type="button" class="icon-close" @click="showBlockForm = false">Close</button>
        <p class="eyebrow">Safety request</p>
        <h2>Request to block a provider</h2>
        <p class="muted">Admin will review this request before any account is blocked.</p>
        <label>Provider name<input v-model="blockForm.targetName"
            placeholder="Provider name from your request" /></label>
        <label>Reason<textarea v-model="blockForm.reason" placeholder="Explain what happened"></textarea></label>
        <button class="primary">Send to admin</button>
      </form>
    </section>
  </section>
</template>
