<template>
  <div class="modal-overlay">
    <form class="signin-modal" @submit.prevent="submit">
      <button type="button" class="close-btn modal-close" @click="$emit('close')" :disabled="isLoading">×</button>
      <p class="eyebrow">Secure account sign in</p>
      <h2>Sign in to Service Hub</h2>
      <p class="muted-text">Only registered users can access a dashboard. Admin demo: Admin / 1111.</p>

      <label>Email or Admin</label>
      <input 
        v-model.trim="identifier" 
        class="booking-input" 
        placeholder="Email address or 'Admin'" 
        required 
        :disabled="isLoading"
      />

      <label>Password</label>
      <input 
        v-model="password" 
        type="password" 
        class="booking-input" 
        placeholder="Password" 
        required 
        :disabled="isLoading"
      />

      <p v-if="error" class="error-text">{{ error }}</p>
      <button class="confirm-btn full-btn" :disabled="isLoading">
        {{ isLoading ? 'Signing in...' : 'Sign in' }}
      </button>
    </form>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  isLoading: { type: Boolean, default: false }
})

const emit = defineEmits(['close', 'sign-in'])
const identifier = ref('')
const password = ref('')
const error = ref('')

function submit() {
  error.value = ''
  
  if (!identifier.value || !password.value) {
    error.value = 'Please enter your email and password.'
    return
  }
  
  emit('sign-in', { identifier: identifier.value, password: password.value })
}
</script>

<style scoped>
.error-text {
  color: #dc2626;
  font-size: 0.875rem;
  margin: 0.5rem 0;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

input:disabled {
  background-color: #f3f4f6;
  cursor: not-allowed;
}
</style>
