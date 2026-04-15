<template>
  <div class="app-shell">
    <Navbar />

    <main>
      <HeroSection
        :search-query="searchQuery"
        :categories="categories"
        :active-category="activeCategory"
        @update-search="updateSearch"
        @select-category="selectCategory"
      />

      <ServiceGrid
        :services="filteredServices"
        :categories="categories"
        :active-category="activeCategory"
        @select-category="selectCategory"
        @book-service="openBooking"
      />

      <FooterSection />
    </main>

    <BookingPanel
      :is-open="isBookingOpen"
      :service="selectedService"
      @close="closeBooking"
      @submit-booking="handleBookingSubmit"
    />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import Navbar from './components/NavBar.vue'
import HeroSection from './components/HeroSection.vue'
import ServiceGrid from './components/ServiceGrid.vue'
import BookingPanel from './components/BookingPanel.vue'
import FooterSection from './components/FooterSection.vue'
import { services } from './data/services.js'

const isBookingOpen = ref(false)
const selectedService = ref(null)
const searchQuery = ref('')
const activeCategory = ref('All')

const categories = computed(() => {
  return ['All', ...new Set(services.map(service => service.category))]
})

const filteredServices = computed(() => {
  return services.filter((service) => {
    const matchesCategory =
      activeCategory.value === 'All' || service.category === activeCategory.value

    const query = searchQuery.value.trim().toLowerCase()

    const matchesSearch =
      query === '' ||
      service.title.toLowerCase().includes(query) ||
      service.provider.toLowerCase().includes(query) ||
      service.description.toLowerCase().includes(query) ||
      service.category.toLowerCase().includes(query)

    return matchesCategory && matchesSearch
  })
})

function updateSearch(value) {
  searchQuery.value = value
}

function selectCategory(category) {
  activeCategory.value = category
}

function openBooking(service) {
  selectedService.value = service
  isBookingOpen.value = true
}

function closeBooking() {
  isBookingOpen.value = false
  selectedService.value = null
}

function handleBookingSubmit(payload) {
  console.log('Booking submitted:', payload)
}
</script>