<script setup>
import { formatStatus } from '../../data/services'

defineProps({
  customer: Object,
  requests: {
    type: Array,
    default: () => []
  }
})

defineEmits(['request-another', 'view-tracking'])
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
        <button class="secondary small" @click="$emit('view-tracking')">View tracking demo</button>
      </div>

      <div class="responsive-table">
        <table>
          <thead>
            <tr>
              <th>Service</th>
              <th>Location</th>
              <th>Date</th>
              <th>Status</th>
              <th>Tracking</th>
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
                <span class="status-pill" :class="request.status">{{ formatStatus(request.status) }}</span>
              </td>
              <td>
                <button class="secondary small" @click="$emit('view-tracking')">Track</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>
