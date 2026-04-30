<template>
  <article class="service-card">
    <img :src="service.image" :alt="service.title" class="service-image" />

    <div class="service-body">
      <div class="card-topline">
        <span>{{ service.category }}</span>
        <strong>{{ pricingBadge }}</strong>
      </div>

      <h3>{{ service.title }}</h3>
      <p class="service-description">{{ service.description }}</p>

      <div class="service-meta">
        <span>⭐ {{ service.rating }} ({{ service.reviews }})</span>
        <span>📍 {{ service.area }} · {{ service.distance }} km</span>
      </div>

      <div class="skill-list">
        <span v-for="skill in service.skills" :key="skill">{{ skill }}</span>
      </div>

      <div class="service-price-block">
        <div>
          <p class="service-price-label">{{ priceLabel }}</p>
          <p class="service-price">{{ formatPrice(service) }}</p>
          <p class="service-provider">by {{ service.provider }}</p>
        </div>

        <button class="book-btn" @click="$emit('book', service)">Choose helper</button>
      </div>
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
  const safeValue = Number(value || 0)

  return new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency: 'BDT',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(safeValue).replace('BDT', '৳')
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
  return 'Starting price'
})

const pricingBadge = computed(() => {
  if (props.service.pricingType === 'hourly') return 'Hourly'
  if (props.service.pricingType === 'estimated') return 'Estimate'
  return 'Fixed'
})
</script>
