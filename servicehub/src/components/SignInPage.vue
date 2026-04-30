<template>
  <section class="auth-page">
    <div class="auth-card">
      <p class="eyebrow">Welcome back</p>
      <h1>Sign in to Service Hub</h1>
      <p>Sign in to manage your requests and dashboard.</p>

      <form @submit.prevent="signIn">
        <input v-model="username" type="text" placeholder="Username" required />
        <input v-model="password" type="password" placeholder="Password" required />

        <button type="submit">Sign in</button>
      </form>

      <p class="auth-hint">
        Admin demo: <strong>Admin</strong> / <strong>1111</strong>
      </p>

      <p class="auth-switch">
        New customer?
        <button @click="$emit('go-register')">Create account</button>
      </p>
    </div>
  </section>
</template>

<script setup>
import { ref } from 'vue'

const emit = defineEmits(['sign-in', 'go-register'])

const username = ref('')
const password = ref('')

function signIn() {
  emit('sign-in', {
    username: username.value,
    password: password.value
  })
}
</script>