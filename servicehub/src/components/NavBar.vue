<template>
  <header class="navbar">
    <div class="nav-inner">
      <button class="brand" @click="$emit('go-home')">
        <span class="logo">S</span>
        <span class="brand-name">Service Hub</span>
      </button>

      <nav class="nav-links">
        <button :class="{ active: activePage === 'services' || activePage === 'services-list' }" @click="$emit('go-home')">Find Services</button>
        <button :class="{ active: activePage === 'how' }" @click="$emit('how-it-works')">How it works</button>
        <button v-if="signedIn" :class="{ active: activePage === 'dashboard' }" @click="$emit('go-dashboard')">Dashboard</button>
      </nav>

      <div class="nav-actions">
        <span v-if="signedIn" class="role-pill">{{ userRole === 'admin' ? 'Admin' : 'Customer' }}</span>
        <template v-if="!signedIn">
          <button class="ghost-btn" @click="$emit('register')">Register</button>
          <button class="signin-btn" @click="$emit('sign-in')">Sign in</button>
        </template>
        <button v-else class="signin-btn" @click="$emit('sign-out')">Sign out</button>
      </div>
    </div>
  </header>
</template>

<script setup>
defineProps({
  signedIn: { type: Boolean, default: false },
  activePage: { type: String, default: 'services' },
  userRole: { type: String, default: 'customer' }
})

defineEmits(['go-home', 'go-dashboard', 'how-it-works', 'sign-in', 'register', 'sign-out'])
</script>
