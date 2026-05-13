<script setup>
// Sign-in page: checks prototype username/password or sends the user to Google sign-in.
import { reactive } from 'vue'
const props = defineProps({ error: { type: String, default: '' } })
const emit = defineEmits(['sign-in', 'go-register', 'google-auth'])
const form = reactive({ username: '', password: '' })
</script>

<template>
  <section class="auth-page">
    <form class="auth-card clean-card" @submit.prevent="$emit('sign-in', { ...form })">
      <p class="eyebrow">Secure access</p>
      <h2>Sign in</h2>
      <p class="muted">Use test accounts customer/1234, provider/2222, admin/1111, or use your registered phone number.
      </p>
      <label>Username or phone<input v-model="form.username" /></label>
      <label>Password<input v-model="form.password" type="password" /></label>
      <p v-if="error" class="error-text">{{ error }}</p>
      <button class="primary">Sign in</button>
      <button type="button" class="secondary" @click="$emit('google-auth')">Continue with Google</button>
      <button type="button" class="link-btn" @click="$emit('go-register')">Create customer account</button>
    </form>
  </section>
</template>
