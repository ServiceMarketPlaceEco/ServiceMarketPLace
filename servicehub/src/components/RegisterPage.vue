<template>
  <section class="auth-page">
    <div class="auth-card">
      <p class="eyebrow">Create account</p>
      <h1>Register for Service Hub</h1>
      <p>Create an account to track requests, review helpers and manage safety actions.</p>

      <form @submit.prevent="register">
        <input v-model="form.name" type="text" placeholder="Full name" required :disabled="isLoading" />
        <input v-model="form.phone" type="tel" placeholder="Phone number" required :disabled="isLoading" />
        <input v-model="form.email" type="email" placeholder="Email address" required :disabled="isLoading" />
        <input v-model="form.password" type="password" placeholder="Password (min 8 characters)" required minlength="8" :disabled="isLoading" />

        <select v-model="form.area" required :disabled="isLoading">
          <option value="">Select area</option>
          <option>Shaheb Bazar</option>
          <option>Laxmipur</option>
          <option>Rajshahi University Area</option>
          <option>Motihar</option>
          <option>Uposhohor</option>
          <option>Other Rajshahi Area</option>
        </select>

        <p v-if="error" class="error-text">{{ error }}</p>

        <button type="submit" :disabled="isLoading">
          {{ isLoading ? 'Creating account...' : 'Create account' }}
        </button>
      </form>

      <p class="auth-switch">
        Already have an account?
        <button @click="$emit('go-signin')" :disabled="isLoading">Sign in</button>
      </p>
    </div>
  </section>
</template>

<script setup>
import { reactive, ref } from 'vue'

const props = defineProps({
  isLoading: { type: Boolean, default: false }
})

const emit = defineEmits(['register', 'go-signin'])

const error = ref('')

const form = reactive({
  name: '',
  phone: '',
  email: '',
  password: '',
  area: ''
})

function register() {
  error.value = ''
  
  // Basic validation
  if (form.password.length < 8) {
    error.value = 'Password must be at least 8 characters long.'
    return
  }
  
  if (!form.email.includes('@')) {
    error.value = 'Please enter a valid email address.'
    return
  }
  
  emit('register', { ...form })
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

input:disabled,
select:disabled {
  background-color: #f3f4f6;
  cursor: not-allowed;
}
</style>
