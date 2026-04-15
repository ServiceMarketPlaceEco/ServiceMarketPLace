<template>
  <section class="hero-section">
    <div class="container hero-content">
      <div class="hero-badge">Trusted by 50,000+ households</div>

      <h1 class="hero-title">
        Book verified service providers
        <span>with your voice</span>
      </h1>

      <p class="hero-text">
        Connect with trusted professionals for all your home and business needs.
        Describe your problem in Bengali or English — our AI understands you.
      </p>

      <div class="search-bar">
        <input
          :value="searchQuery"
          type="text"
          placeholder="Describe your problem or search services..."
          @input="$emit('update-search', $event.target.value)"
        />
        <button class="icon-btn" aria-label="Voice search">🎤</button>
        <button class="search-btn">Search</button>
      </div>

      <p class="location-text">Melbourne, VIC</p>

      <div class="category-pills">
        <button
          v-for="category in categories"
          :key="category"
          :class="{ active: activeCategory === category }"
          @click="$emit('select-category', category)"
        >
          {{ category }}
        </button>
      </div>
    </div>
  </section>
</template>

<script setup>
defineProps({
  searchQuery: {
    type: String,
    default: ''
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

defineEmits(['update-search', 'select-category'])
</script>