<script setup>
import { reactive } from 'vue'

const emit = defineEmits(['sign-in', 'go-register'])

const form = reactive({
  identifier: '',
  password: ''
})

function submit() {
  emit('sign-in', {
    identifier: form.identifier,
    password: form.password
  })
}
</script>

<template>
  <section class="auth-page signin-page split-auth-page">
    <form class="auth-card clean-card" @submit.prevent="submit">
      <p class="eyebrow">Sign in</p>
      <h2>Access your dashboard</h2>
      <p class="muted">
        Enter your username or phone number. Your account type will be detected automatically.
      </p>

      <label>
        Username or phone number
        <input
          v-model.trim="form.identifier"
          required
          autocomplete="username"
          placeholder="Enter your username or phone number"
        />
      </label>

      <label>
        Password
        <input
          v-model="form.password"
          type="password"
          required
          autocomplete="current-password"
          placeholder="Enter password"
        />
      </label>

      <button class="primary" type="submit">Sign in</button>
      <button
        class="secondary"
        type="button"
        @click="emit('sign-in', { identifier: 'google.customer@servicehub.local', name: 'Google Customer', authProvider: 'google' })"
      >
        Continue with Google demo
      </button>
      <button class="secondary" type="button" @click="emit('go-register')">
        Create customer account
      </button>
    </form>

    <aside class="signin-visual clean-card">
      <div class="dashboard-preview-card">
        <p class="eyebrow">Secure portal</p>
        <h3>One login, three role-based dashboards</h3>

        <div class="login-preview-row">
          <span>👤</span>
          <div><strong>Customer</strong><small>Request services and track progress</small></div>
        </div>

        <div class="login-preview-row">
          <span>🛠</span>
          <div><strong>Provider</strong><small>Accept jobs and manage reviews</small></div>
        </div>

        <div class="login-preview-row">
          <span>🛡</span>
          <div><strong>Admin</strong><small>Approve providers, assign jobs and control chat</small></div>
        </div>
      </div>
    </aside>
  </section>
</template>
