<script setup>
const props = defineProps({
  activePage: String,
  signedInUser: Object,
  theme: String
})

const emit = defineEmits(['navigate', 'sign-out', 'toggle-theme'])

// The public logo returns to the guest landing page.
// After sign-in, the same logo returns the user to their role-based dashboard.
function goHome() {
  emit('navigate', props.signedInUser ? 'dashboard' : 'home')
}
</script>

<template>
  <header class="navbar app-navbar">
    <div class="nav-inner">
      <button class="brand-logo" type="button" @click="goHome" aria-label="Go to ServiceHub home">
        <img src="/lightlogo.png" alt="ServiceHub logo" />
        <span>ServiceHub</span>
      </button>

      <nav class="nav-links" aria-label="Main navigation">
        <!-- Guests are already on the landing page, so they do not need Home. -->
        <!-- For signed-in users, Home means their role-based dashboard. -->
        <button
          v-if="signedInUser"
          :class="{ active: activePage === 'dashboard' }"
          @click="$emit('navigate', 'dashboard')"
        >
          Home
        </button>
        <button v-if="!signedInUser" :class="{ active: activePage === 'how' }" @click="$emit('navigate', 'how')">How it works</button>
        <button :class="{ active: activePage === 'reviews' }" @click="$emit('navigate', 'reviews')">Reviews</button>
        <button v-if="!signedInUser" :class="{ active: activePage === 'provider-register' }" @click="$emit('navigate', 'provider-register')">Become a provider</button>
        <button v-if="signedInUser?.role === 'customer'" :class="{ active: activePage === 'services' }" @click="$emit('navigate', 'services')">Services</button>
      </nav>

      <div class="nav-actions">
        <button class="theme-toggle" type="button" @click="$emit('toggle-theme')">
          {{ theme === 'dark' ? 'Light mode' : 'Dark mode' }}
        </button>
        <!-- Sign in is grouped beside the theme button instead of in the main links. -->
        <button
          v-if="!signedInUser"
          class="secondary small"
          type="button"
          :class="{ active: activePage === 'signin' }"
          @click="$emit('navigate', 'signin')"
        >
          Sign in
        </button>
        <button v-if="signedInUser" class="account-pill" type="button" @click="$emit('navigate', 'dashboard')">
          {{ signedInUser.name }}
        </button>
        <button v-if="signedInUser" class="secondary small" type="button" @click="$emit('sign-out')">Log out</button>
      </div>
    </div>
  </header>
</template>
