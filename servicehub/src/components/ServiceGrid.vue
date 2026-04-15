<template>
  <section class="services-section">
    <div class="container">
      <div class="section-heading">
        <div>
          <h2>Popular Services</h2>
          <p>Book trusted professionals for home and business needs.</p>
        </div>
        <a href="#" class="view-link">View all</a>
      </div>

      <div class="filter-row">
        <button
          v-for="category in categories"
          :key="category"
          class="filter-chip"
          :class="{ active: activeCategory === category }"
          @click="$emit('select-category', category)"
        >
          {{ category }}
        </button>
      </div>

      <div v-if="services.length" class="service-grid">
        <ServiceCard
          v-for="service in services"
          :key="service.id"
          :service="service"
          @book="$emit('book-service', $event)"
        />
      </div>

      <div v-else class="empty-state">
        <h3>No services found</h3>
        <p>Try another search term or category.</p>
      </div>
    </div>
  </section>
</template>

<script setup>
import ServiceCard from './ServiceCard.vue'

defineProps({
  services: {
    type: Array,
    default: () => []
  },
  categories: {
    type: Array,
    default: () => []
  },
  activeCategory: {
    type: String,
    default: 'All'
  }
})

defineEmits(['select-category', 'book-service'])
</script>