<template>
  <article class="service-card">
    <div class="service-card-top">
      <div class="service-icon">⚙️</div>
      <span class="service-badge">{{ pricingBadge }}</span>
    </div>

    <h3>{{ service.title }}</h3>
    <p class="service-description">{{ service.description }}</p>

    <div class="service-meta">
      <span>⭐ {{ service.rating }} ({{ service.reviews }})</span>
      <span>⏱ {{ service.time }}</span>
      <span>📍 {{ service.distance }} km</span>
    </div>

    <div class="service-price-block">
      <div>
        <p class="service-price-label">{{ priceLabel }}</p>
        <p class="service-price">{{ formatPrice(service) }}</p>
        <p class="service-provider">by {{ service.provider }}</p>
      </div>

      <button class="book-btn" @click="$emit('book', service)">Book Now</button>
    </div>
  </article>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  service: {
    type: Object,
    required: true
  }
})

defineEmits(['book'])

function formatCurrency(value) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(value)
}

function formatPrice(service) {
  if (service.pricingType === 'hourly') {
    return `${formatCurrency(service.price)}/hr`
  }

  if (service.pricingType === 'estimated') {
    return `${formatCurrency(service.basePrice)}–${formatCurrency(service.maxPrice)}`
  }

  return formatCurrency(service.price)
}

const priceLabel = computed(() => {
  if (props.service.pricingType === 'hourly') return 'Hourly rate'
  if (props.service.pricingType === 'estimated') return 'Estimated price'
  return 'Fixed price'
})

const pricingBadge = computed(() => {
  if (props.service.pricingType === 'hourly') return 'Hourly'
  if (props.service.pricingType === 'estimated') return 'Estimate'
  return 'Fixed'
})
</script>