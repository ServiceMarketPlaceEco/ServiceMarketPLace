<template>
  <section class="services-section">
    <div class="service-toolbar">
      <div class="filter-row">
        <button
          v-for="category in categories"
          :key="category"
          :class="['filter-chip', { active: selectedCategory === category }]"
          @click="$emit('update-category', category)"
        >
          {{ category }}
        </button>
      </div>

      <select :value="sortMode" @change="$emit('update-sort', $event.target.value)" class="sort-select">
        <option value="recommended">Recommended</option>
        <option value="price-low">Lowest price</option>
        <option value="rating">Highest rating</option>
      </select>
    </div>

    <div v-if="services.length" class="service-grid">
      <ServiceCard
        v-for="service in services"
        :key="service.id"
        :service="service"
        @book="$emit('book-service', service)"
      />
    </div>

    <div v-else class="empty-state">
      <h3>No services found</h3>
      <p>Try a different area, category, or search term.</p>
    </div>
  </section>
</template>

<script>
import ServiceCard from './ServiceCard.vue'

export default {
  name: 'ServiceGrid',
  components: { ServiceCard },
  props: {
    services: { type: Array, required: true },
    categories: { type: Array, required: true },
    selectedCategory: { type: String, required: true },
    sortMode: { type: String, required: true }
  },
  emits: ['update-category', 'update-sort', 'book-service']
}
</script>
