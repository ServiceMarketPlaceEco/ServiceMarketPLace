<template>
  <section class="dashboard-page">
    <div class="container page-section">
      <div class="dashboard-header">
        <div>
          <p class="eyebrow">Admin dashboard</p>
          <h2>Service Hub Rajshahi admin</h2>
          <p>Monitor requests, update statuses, and review marketplace activity.</p>
        </div>
      </div>

      <div class="dash-metrics">
        <article><h3>{{ services.length }}</h3><p>Listed services</p></article>
        <article><h3>{{ bookings.length }}</h3><p>Total requests</p></article>
        <article><h3>{{ acceptedCount }}</h3><p>Accepted jobs</p></article>
        <article><h3>{{ pendingCount }}</h3><p>Pending review</p></article>
      </div>

      <div class="dash-card">
        <div class="dash-card-head"><h2>Request management</h2></div>
        <div v-if="!bookings.length" class="empty-dashboard">No customer requests yet.</div>
        <div v-else class="request-table modern">
          <div class="table-row header"><span>ID</span><span>Service</span><span>Provider</span><span>Area</span><span>Date</span><span>Status</span><span>Admin action</span></div>
          <div v-for="booking in bookings" :key="booking.id" class="table-row">
            <span>{{ booking.id }}</span>
            <strong>{{ booking.service }}</strong>
            <span>{{ booking.provider }}</span>
            <span>{{ booking.area }}</span>
            <span>{{ booking.date }}</span>
            <span class="status-pill">{{ booking.status }}</span>
            <select :value="booking.status" @change="$emit('update-status', { id: booking.id, status: $event.target.value })">
              <option>Pending</option>
              <option>Accepted</option>
              <option>Completed</option>
              <option>Cancelled</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
const props = defineProps({ bookings: { type: Array, required: true }, services: { type: Array, required: true } })
defineEmits(['update-status'])
const acceptedCount = computed(() => props.bookings.filter(item => item.status === 'Accepted').length)
const pendingCount = computed(() => props.bookings.filter(item => item.status === 'Pending').length)
</script>
