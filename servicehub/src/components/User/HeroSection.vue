<script setup>
// Guests start by creating a customer account before accessing services.
defineEmits(['get-started', 'learn-more'])
</script>

<template>
  <section class="hero-shell">
    <div class="hero-card clean-card">
      <div class="hero-copy">
        <p class="eyebrow">Rajshahi local service marketplace</p>
        <h1>Book trusted local help with live status tracking.</h1>
        <p class="hero-text">
          Customers can request services, providers manage jobs, and admins approve provider accounts before platform
          access.
        </p>
        <div class="hero-actions">
          <button class="primary" type="button" @click="$emit('get-started')">Get started</button>
          <button class="secondary" type="button" @click="$emit('learn-more')">How it works</button>
        </div>
      </div>

      <aside class="price-card">
        <span>Clear updates from booking to completion</span>
        <strong>Book with confidence</strong>
        <p>Find verified providers, manage requests and follow service progress in one place.</p>
      </aside>
    </div>
  </section>
</template>
