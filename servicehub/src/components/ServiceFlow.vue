<script setup>
// service flow component: switches between service cards and task options for one selected service.
const props = defineProps({
  services: { type: Array, required: true },
  mode: { type: String, default: 'services' },
  selectedService: { type: Object, default: null }
})

// App.vue listens to these events to keep navigation and form state centralised.
defineEmits(['select-service', 'select-task', 'back'])
</script>

<template>
  <section class="page-section service-page" v-if="mode === 'services'">
    <div class="section-heading left">
      <p class="eyebrow">Rajshahi Service Hub</p>
      <h2>Book trusted local help around Rajshahi</h2>
      <p>Choose a service category first. Then describe your request so local helpers can respond.</p>
    </div>

    <div class="service-grid refined">
      <article v-for="service in services" :key="service.id" class="service-card clean-card"
        @click="$emit('select-service', service)">
        <img :src="service.image" :alt="service.title" class="service-image" />
        <div class="service-body">
          <span class="category-label">{{ service.category }}</span>
          <h3>{{ service.title }}</h3>
          <p>{{ service.description }}</p>
          <div class="card-footer-row">
            <strong>from ৳{{ service.price }}</strong>
            <button>View tasks</button>
          </div>
        </div>
      </article>
    </div>
  </section>

  <section class="page-section detail-page" v-else>
    <button class="back-pill" @click="$emit('back')">Back to services</button>
    <div class="task-layout clean-card">
      <div class="task-panel">
        <p class="eyebrow">{{ selectedService?.title }}</p>
        <h2>What would you like help with?</h2>
        <p>{{ selectedService?.description }}</p>
        <div class="task-list">
          <button v-for="task in selectedService?.tasks" :key="task" class="task-option"
            @click="$emit('select-task', task)">
            <span>{{ task }}</span>
            <span class="task-arrow" aria-hidden="true">›</span>
          </button>
        </div>
      </div>
      <img :src="selectedService?.image" :alt="selectedService?.title" class="detail-image" />
    </div>
  </section>
</template>
