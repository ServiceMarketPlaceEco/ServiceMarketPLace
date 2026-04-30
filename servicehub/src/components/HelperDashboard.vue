<template>
  <section class="dashboard-page">
    <div class="container">
      <div class="dashboard-header">
        <div>
          <p class="eyebrow">Helper dashboard</p>
          <h2>Available Rajshahi tasks</h2>
          <p>Accept and update customer service requests.</p>
        </div>
      </div>

      <div class="task-list">
        <article v-for="booking in bookings" :key="booking.id" class="task-card">
          <div>
            <h3>{{ booking.serviceTitle }}</h3>
            <p>{{ booking.area }} · {{ booking.date }} at {{ booking.time }}</p>
            <p>Customer: {{ booking.customerName }} · {{ booking.phone }}</p>
            <p class="muted-text">{{ booking.notes || 'No extra notes provided.' }}</p>
          </div>
          <div class="status-actions">
            <span class="status-pill">{{ booking.status }}</span>
            <button @click="$emit('update-status', { id: booking.id, status: 'Accepted' })">Accept</button>
            <button @click="$emit('update-status', { id: booking.id, status: 'Completed' })">Complete</button>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>

<script>
export default {
  name: 'HelperDashboard',
  props: {
    bookings: { type: Array, required: true }
  },
  emits: ['update-status']
}
</script>
