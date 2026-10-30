<script setup>
import { computed, ref, watch } from 'vue'
import { formatBDT, serviceImageSrc } from '../../data/services'

const props = defineProps({
  service: {
    type: Object,
    required: true
  }
})

defineEmits(['request'])

// Show a placeholder instead of a broken image when there is no photo or it fails to load.
const imageFailed = ref(false)
const imageSrc = computed(() => serviceImageSrc(props.service.image))
watch(imageSrc, () => { imageFailed.value = false })
</script>

<template>
  <article class="service-card clean-card">
    <div class="service-photo-wrap">
      <img v-if="imageSrc && !imageFailed" class="service-image" :src="imageSrc" :alt="service.title"
        loading="lazy" @error="imageFailed = true" />
      <div v-else class="service-image-placeholder" role="img" :aria-label="service.title">
        {{ service.title?.charAt(0) || 'S' }}
      </div>
      <span class="verified-badge">Verified local</span>
    </div>

    <div class="service-body">
      <div class="service-topline">
        <span class="category-label">{{ service.category }}</span>
        <span>Rajshahi</span>
      </div>

      <h3>{{ service.title }}</h3>
      <p>{{ service.description }}</p>

      <div class="service-stats">
        <div><span>response</span><strong>15 min</strong></div>
        <div><span>rating</span><strong>4.8/5</strong></div>
        <div><span>area</span><strong>local</strong></div>
      </div>

      <div class="card-footer-row">
        <strong>From {{ formatBDT(service.price) }}</strong>
        <button class="service-request-btn" type="button" @click="$emit('request', service)">Request service</button>
      </div>
    </div>
  </article>
</template>
