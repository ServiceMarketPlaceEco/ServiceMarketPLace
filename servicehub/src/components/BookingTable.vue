<!-- component note: this component keeps the original service hub layout and is annotated for easier tutor explanation. -->
<template>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>Service</th>
          <th>Area</th>
          <th>Date</th>
          <th>Payment</th>
          <th>Total</th>
          <th>Status</th>
          <th v-if="admin">Admin action</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="booking in bookings" :key="booking.id">
          <td>{{ booking.serviceTitle }}</td>
          <td>{{ booking.area }}</td>
          <td>{{ booking.date }} {{ booking.time }}</td>
          <td>{{ booking.payment }}</td>
          <td>৳{{ booking.total }}</td>
          <td><span class="status-pill">{{ booking.status }}</span></td>
          <td v-if="admin">
            <select :value="booking.status" @change="$emit('change-status', { id: booking.id, status: $event.target.value })">
              <option>Pending</option>
              <option>Accepted</option>
              <option>Completed</option>
              <option>Cancelled</option>
            </select>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script>
export default {
  name: 'BookingTable',
  props: {
    bookings: { type: Array, required: true },
    admin: { type: Boolean, default: false }
  },
  emits: ['change-status']
}
</script>
