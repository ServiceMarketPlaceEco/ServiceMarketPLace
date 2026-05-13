<script setup>
// hero component: introduces the marketplace and sends users to services/dashboard.
defineProps({ location: { type: String, default: 'Rajshahi City' } })
defineEmits(['find-services', 'view-dashboard'])
</script>

<template>
  <section class="hero-shell">
    <div class="hero-card clean-card">
      <div class="hero-copy">
        <p class="eyebrow">Rajshahi local service marketplace</p>
        <h1>Book trusted local help without the messy back-and-forth.</h1>
        <p class="hero-text">Service Hub connects customers with verified helpers in {{ location }} for bazaar shopping,
          medicine pickup, deliveries, cleaning, tutoring and family support.</p>
        <div class="hero-actions">
          <button class="primary" @click="$emit('find-services')">Find services</button>
          <button class="secondary" @click="$emit('view-dashboard')">View dashboard</button>
        </div>
      </div>
      <aside class="price-card">
        <span>Suggested starting price</span>
        <strong>From ৳150</strong>
        <p>Transparent local pricing before sending a request.</p>
      </aside>
    </div>
  </section>
</template>
