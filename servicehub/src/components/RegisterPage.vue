<template>
  <section class="auth-page">
    <div class="auth-card">
      <p class="eyebrow">Create account</p>
      <h1>Register for Service Hub</h1>
      <p>Create an account to track requests, review helpers and manage safety actions.</p>

      <form @submit.prevent="register">
        <input v-model="form.name" type="text" placeholder="Full name" required />
        <input v-model="form.phone" type="tel" placeholder="Phone number" required />
        <input v-model="form.email" type="email" placeholder="Email address" required />
        <input v-model="form.password" type="password" placeholder="Password" required />

        <select v-model="form.area" required>
          <option value="">Select area</option>
          <option>Shaheb Bazar</option>
          <option>Laxmipur</option>
          <option>Rajshahi University Area</option>
          <option>Motihar</option>
          <option>Uposhohor</option>
          <option>Other Rajshahi Area</option>
        </select>

        <button type="submit">Create account</button>
      </form>

      <p class="auth-switch">
        Already have an account?
        <button @click="$emit('go-signin')">Sign in</button>
      </p>
    </div>
  </section>
</template>

<script setup>
import { reactive } from 'vue'

const emit = defineEmits(['register', 'go-signin'])

const form = reactive({
  name: '',
  phone: '',
  email: '',
  password: '',
  area: ''
})

function register() {
  emit('register', { ...form })
}
</script>