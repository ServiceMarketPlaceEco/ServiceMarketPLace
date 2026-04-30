<template>
  <div class="modal-overlay">
    <form class="signin-modal" @submit.prevent="submit">
      <button type="button" class="close-btn modal-close" @click="$emit('close')">×</button>
      <p class="eyebrow">Secure account sign in</p>
      <h2>Sign in to Service Hub</h2>
      <p class="muted-text">Only registered users can access a dashboard. Admin demo: Admin / 1111.</p>

      <label>Email, phone, or Admin</label>
      <input v-model.trim="identifier" class="booking-input" placeholder="Email, phone, or Admin" required />

      <label>Password</label>
      <input v-model="password" type="password" class="booking-input" placeholder="Password" required />

      <p v-if="error" class="error-text">{{ error }}</p>
      <button class="confirm-btn full-btn">Sign in</button>
    </form>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const emit = defineEmits(['close', 'sign-in'])
const identifier = ref('')
const password = ref('')
const error = ref('')

function submit() {
  if (!identifier.value || !password.value) {
    error.value = 'Please enter your account and password.'
    return
  }
  emit('sign-in', { identifier: identifier.value, password: password.value })
}
</script>
