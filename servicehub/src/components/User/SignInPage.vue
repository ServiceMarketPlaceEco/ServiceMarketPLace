<script setup>
import { reactive, ref } from 'vue'

const emit = defineEmits(['sign-in', 'go-register', 'forgot-password', 'reset-password'])

const form = reactive({
  role: 'customer',
  identifier: '',
  password: ''
})

const showReset = ref(false)
const resetForm = reactive({
  email: '',
  token: '',
  newPassword: ''
})

function submit() {
  emit('sign-in', {
    role: form.role,
    email: form.identifier,
    name: form.identifier || undefined,
    password: form.password
  })
}

function requestReset() {
  if (!resetForm.email.trim()) return
  emit('forgot-password', { email: resetForm.email.trim(), userType: form.role })
}

function submitReset() {
  if (!resetForm.token.trim() || !resetForm.newPassword.trim()) return
  emit('reset-password', { token: resetForm.token.trim(), newPassword: resetForm.newPassword })
}
</script>

<template>
  <section class="auth-page signin-page split-auth-page">
    <form class="auth-card clean-card" @submit.prevent="submit">
      <p class="eyebrow">Sign in</p>
      <h2>Access your dashboard</h2>
      <p class="muted">
        Customers, providers and admins use one secure portal, then each role opens a different workspace.
      </p>

      <label>
        Account type
        <select v-model="form.role">
          <option value="customer">Customer dashboard</option>
          <option value="provider">Provider dashboard</option>
          <option value="admin">Admin dashboard</option>
        </select>
      </label>

      <label>
        Name, phone or ID
        <input v-model="form.identifier" required placeholder="Example: admin01 or PROV-DEMO-01" />
      </label>

      <label>
        Password
        <input v-model="form.password" type="password" required placeholder="Enter password" />
      </label>

      <button class="link-btn" type="button" @click="showReset = !showReset">Forgot password?</button>

      <div v-if="showReset" class="clean-card" style="padding: 16px; margin-bottom: 12px;">
        <p class="muted">Enter your email to request a reset link, then paste the token you receive to set a new password.</p>
        <label>
          Email
          <input v-model="resetForm.email" type="email" placeholder="you@example.com" />
        </label>
        <button class="secondary small" type="button" @click="requestReset">Send reset link</button>

        <label style="margin-top: 12px; display: block;">
          Reset token
          <input v-model="resetForm.token" placeholder="Paste the token from your email" />
        </label>
        <label>
          New password
          <input v-model="resetForm.newPassword" type="password" placeholder="New password" />
        </label>
        <button class="primary small" type="button" @click="submitReset">Reset password</button>
      </div>

      <button class="primary" type="submit">Sign in</button>
      <button
        class="secondary"
        type="button"
        @click="emit('sign-in', { role: 'customer', name: 'Google Customer', email: 'google.customer@servicehub.local' })"
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
