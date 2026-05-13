<script setup>
// Register component: creates a customer account with required name, phone number and location.
import { reactive, ref } from 'vue'

const props = defineProps({ locations: { type: Array, default: () => ['Rajshahi City'] } })
const emit = defineEmits(['register', 'go-signin', 'google-auth'])

const form = reactive({ name: '', phone: '', password: '', location: 'Rajshahi City' })
const error = ref('')

function submit() {
  const digits = form.phone.replace(/\D/g, '')
  if (!form.name.trim() || !form.phone.trim() || !form.location || !form.password) {
    error.value = 'Please complete name, phone number, location and password.'
    return
  }
  if (digits.length < 10) {
    error.value = 'Please enter a valid phone number.'
    return
  }
  error.value = ''
  emit('register', { ...form })
}
</script>

<template>
  <section class="auth-page">
    <form class="auth-card clean-card" @submit.prevent="submit">
      <p class="eyebrow">Create account</p>
      <h2>Register for Service Hub</h2>

      <label>Full name *<input v-model="form.name" placeholder="Your name" /></label>
      <label>Phone number *<input v-model="form.phone" placeholder="Example: 017XXXXXXXX" /></label>
      <label>Password *<input v-model="form.password" type="password" /></label>
      <label>Location *<select v-model="form.location">
          <option v-for="location in locations" :key="location">{{ location }}</option>
        </select></label>

      <p v-if="error" class="error-text">{{ error }}</p>
      <button class="primary">Create account</button>
      <button type="button" class="secondary" @click="$emit('google-auth')">Continue with Google</button>
      <button type="button" class="link-btn" @click="$emit('go-signin')">Already have an account? Sign in</button>
    </form>
  </section>
</template>
