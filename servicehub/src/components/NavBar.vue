<script setup>
// Navbar component: public navigation, current account display, location control and theme toggle.
defineProps({
  signedIn: { type: Boolean, default: false },
  activePage: { type: String, default: 'home' },
  userRole: { type: String, default: 'customer' },
  userName: { type: String, default: '' },
  location: { type: String, default: 'Rajshahi City' },
  theme: { type: String, default: 'light' }
})

const emit = defineEmits(['go-home', 'find-services', 'how-it-works', 'sign-in', 'register', 'sign-out', 'go-dashboard', 'open-location', 'toggle-theme'])
</script>

<template>
  <header class="navbar">
    <div class="nav-inner">
      <button class="brand-text" @click="emit('go-home')">Service Hub</button>

      <nav class="nav-links" aria-label="primary navigation">
        <button :class="{ active: activePage === 'services' }" @click="emit('find-services')">Find Services</button>
        <button :class="{ active: activePage === 'how' }" @click="emit('how-it-works')">How it works</button>
      </nav>

      <div class="nav-actions">
        <button class="location-pill" @click="emit('open-location')">
          <span>Area</span>
          {{ location }}
        </button>

        <button class="theme-toggle" @click="emit('toggle-theme')">
          {{ theme === 'light' ? 'Dark mode' : 'Light mode' }}
        </button>

        <button v-if="signedIn" class="account-pill" @click="emit('go-dashboard')">
          <span>{{ userRole }}</span>
          {{ userName }}
        </button>

        <button v-if="!signedIn" class="nav-link-btn" @click="emit('register')">Register</button>
        <button v-if="!signedIn" class="primary small" @click="emit('sign-in')">Sign in</button>
        <button v-if="signedIn" class="nav-link-btn" @click="emit('sign-out')">Sign out</button>
      </div>
    </div>
  </header>
</template>
