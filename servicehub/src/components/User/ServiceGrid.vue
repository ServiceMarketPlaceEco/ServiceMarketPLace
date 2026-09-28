<script setup>
import { computed, ref } from 'vue'
import ServiceCard from './ServiceCard.vue'
import VoiceSearch from '../AI/VoiceSearch.vue'

const props = defineProps({
  services: { type: Array, default: () => [] }
})

const emit = defineEmits(['request-service'])

const searchQuery = ref('')
const selectedCategory = ref('All')

const categories = computed(() => ['All', ...new Set(props.services.map(service => service.category))])

const filteredServices = computed(() => {
  const query = searchQuery.value.toLowerCase().trim()

  return props.services.filter(service => {
    const matchesCategory = selectedCategory.value === 'All' || service.category === selectedCategory.value
    const searchable = `${service.title} ${service.category} ${service.description}`.toLowerCase()
    return matchesCategory && (!query || searchable.includes(query))
  })
})

// VoiceSearch returns a user-checked transcript and selected service.
// Show the transcript in the search box, then reuse the existing booking event.
function handleVoiceConfirmation(result) {
  searchQuery.value = result.transcript
  selectedCategory.value = 'All'
  emit('request-service', result.service)
}
</script>

<template>
  <section class="page-section" id="services">
    <div class="section-heading">
      <p class="eyebrow">Rajshahi service categories</p>
      <h2>Choose trusted local help</h2>
      <p>Browse household, repair, delivery, care and support services for Rajshahi customers.</p>
    </div>

    <div class="search-card clean-card">
      <label for="service-search">Search services</label>

      <div class="search-input-wrap voice-enabled-search">
        <svg class="search-svg" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M10.8 18.1a7.3 7.3 0 1 1 5.2-2.2l3.8 3.8-1.7 1.7-3.8-3.8a7.2 7.2 0 0 1-3.5.5Zm0-2.4a4.9 4.9 0 1 0 0-9.8 4.9 4.9 0 0 0 0 9.8Z" />
        </svg>

        <input
          id="service-search"
          v-model="searchQuery"
          type="search"
          placeholder="Try cleaning, AC repair, delivery, tutoring..."
        />

        <!-- Recording and transcript confirmation are kept in VoiceSearch.vue. -->
        <VoiceSearch
          :services="services"
          @confirmed="handleVoiceConfirmation"
        />
      </div>

      <div class="category-row" aria-label="Service categories">
        <button
          v-for="category in categories"
          :key="category"
          type="button"
          :class="{ active: selectedCategory === category }"
          @click="selectedCategory = category"
        >
          {{ category === 'All' ? 'All' : category }}
        </button>
      </div>
    </div>

    <div v-if="filteredServices.length" class="service-grid refined">
      <ServiceCard
        v-for="service in filteredServices"
        :key="service.id"
        :service="service"
        @request="$emit('request-service', $event)"
      />
    </div>

    <div v-else class="empty-state">
      No matching services found. Try another keyword or category.
    </div>
  </section>
</template>

<style scoped>
/* Anchor the separate VoiceSearch microphone button inside the search box. */
.voice-enabled-search {
  position: relative;
}

/* Keep typed text clear of the microphone button. */
.voice-enabled-search input {
  padding-right: 4.75rem;
}
</style>
