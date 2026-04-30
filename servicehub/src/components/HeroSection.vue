<template>
  <section class="hero">
    <div>
      <span class="eyebrow">Rajshahi local service marketplace</span>
      <h1>Book trusted local help for daily tasks.</h1>
      <p>
        ServiceHub connects customers with verified helpers for bazaar shopping,
        medicine pickup, deliveries, cleaning, tutoring and family support.
      </p>

      <div class="hero-actions">
        <button class="primary" @click="$emit('find-services')">Find services</button>
        <button class="secondary" @click="$emit('view-dashboard')">View dashboard</button>
      </div>
    </div>

    <div class="hero-card">
      <strong>Suggested starting price</strong>
      <h2>From ৳150</h2>
      <p>Transparent local pricing before sending a request.</p>
    </div>
  </section>
</template>

<script setup>
defineEmits(['find-services', 'view-dashboard'])
</script>
