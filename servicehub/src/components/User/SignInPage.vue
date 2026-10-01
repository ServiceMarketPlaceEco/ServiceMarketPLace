<script setup>
import { onMounted, reactive, ref } from 'vue'
import { getGoogleClientId, loadGoogleIdentity } from '../../services/googleIdentity'

// App.vue receives these events and performs the API requests.
const emit = defineEmits(['sign-in', 'google-sign-in', 'go-register', 'forgot-password', 'reset-password'])

// Set by App.vue when Google sign-in fails, e.g. the email isn't registered.
defineProps({ googleError: { type: String, default: '' } })

const form = reactive({ identifier: '', password: '' })
const showPassword = ref(false)
const showReset = ref(false)
const resetForm = reactive({ email: '', token: '', newPassword: '' })

function submit() {
  emit('sign-in', {
    identifier: form.identifier.trim(),
    password: form.password
  })
}

const googleButton = ref(null)
const googleUnavailable = ref('')

// Renders Google's own button; it hands back an ID token for the backend to
// verify and match against the email the account was registered with.
onMounted(async () => {
  const clientId = getGoogleClientId()
  if (!clientId) {
    googleUnavailable.value = 'Google sign-in is not configured yet.'
    return
  }

  try {
    const google = await loadGoogleIdentity()
    if (!googleButton.value) return
    google.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => emit('google-sign-in', { credential: response.credential })
    })
    google.accounts.id.renderButton(googleButton.value, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'rectangular',
      logo_alignment: 'center',
      width: Math.min(googleButton.value.clientWidth || 400, 400)
    })
  } catch {
    googleUnavailable.value = 'Could not load Google sign-in. Check your connection and try again.'
  }
})

function requestReset() {
  const email = resetForm.email.trim()
  if (email) emit('forgot-password', { email })
}

function submitReset() {
  const token = resetForm.token.trim()
  const newPassword = resetForm.newPassword.trim()
  if (token && newPassword) emit('reset-password', { token, newPassword })
}
</script>

<template>
  <section class="signin-page" aria-labelledby="signin-title">
    <div class="signin-layout">
      <form class="signin-card" @submit.prevent="submit">
        <div class="signin-heading">
          <p class="signin-eyebrow">Welcome back</p>
          <h1 id="signin-title">Access your dashboard</h1>
          <p>
            Sign in using your username, phone number or email. ServiceHub will
            open the correct customer, provider or admin dashboard.
          </p>
        </div>

        <div class="field-group">
          <label for="signin-identifier">Username, phone number or email</label>
          <input id="signin-identifier" v-model.trim="form.identifier" name="identifier" type="text" required
            autocomplete="username" placeholder="For example: amy01 or PR1001" />
        </div>

        <div class="field-group">
          <label for="signin-password">Password</label>
          <div class="password-field">
            <input id="signin-password" v-model="form.password" name="password"
              :type="showPassword ? 'text' : 'password'" required autocomplete="current-password"
              placeholder="Enter your password" />
            <button class="password-toggle" type="button" :aria-label="showPassword ? 'Hide password' : 'Show password'"
              @click="showPassword = !showPassword">
              {{ showPassword ? 'Hide' : 'Show' }}
            </button>
          </div>
        </div>

        <button class="forgot-button" type="button" :aria-expanded="showReset" aria-controls="reset-panel"
          @click="showReset = !showReset">
          {{ showReset ? 'Close password reset' : 'Forgot your password?' }}
        </button>

        <section v-if="showReset" id="reset-panel" class="reset-panel" aria-labelledby="reset-title">
          <h2 id="reset-title">Reset password</h2>
          <p>Request a link first, then use the token sent to your email.</p>

          <div class="field-group">
            <label for="reset-email">Email address</label>
            <input id="reset-email" v-model.trim="resetForm.email" type="email" autocomplete="email"
              placeholder="you@example.com" />
          </div>
          <button class="outline-button" type="button" @click="requestReset">Send reset link</button>

          <div class="field-group">
            <label for="reset-token">Reset token</label>
            <input id="reset-token" v-model.trim="resetForm.token" autocomplete="one-time-code"
              placeholder="Paste the token from your email" />
          </div>

          <div class="field-group">
            <label for="reset-password">New password</label>
            <input id="reset-password" v-model="resetForm.newPassword" type="password" autocomplete="new-password"
              placeholder="Create a new password" />
          </div>
          <button class="primary-button" type="button" @click="submitReset">Reset password</button>
        </section>

        <button class="primary-button signin-submit" type="submit">Sign in securely</button>
        <div class="divider" aria-hidden="true"><span>or</span></div>
        <div v-if="!googleUnavailable" ref="googleButton" class="google-button" />
        <template v-else>
          <button class="outline-button" type="button" disabled>Continue with Google</button>
          <p class="google-note">{{ googleUnavailable }}</p>
        </template>
        <p v-if="googleError" class="google-error" role="alert">
          {{ googleError }}
          <button type="button" @click="emit('go-register')">Create an account</button>
        </p>

        <p class="register-prompt">
          New to ServiceHub?
          <button type="button" @click="emit('go-register')">Create a customer account</button>
        </p>
      </form>

      <aside class="signin-showcase" aria-label="ServiceHub account benefits">
        <div>
          <p class="showcase-eyebrow">One secure portal</p>
          <h2>The right workspace opens automatically.</h2>
          <p class="showcase-description">
            Your verified account controls which tools and dashboard you can access.
          </p>
        </div>

        <ul class="role-list">
          <li>
            <span aria-hidden="true">01</span>
            <div><strong>Customer dashboard</strong>
              <p>Book local services and follow every status update.</p>
            </div>
          </li>
          <li>
            <span aria-hidden="true">02</span>
            <div><strong>Provider workspace</strong>
              <p>Accept assigned work and manage service progress.</p>
            </div>
          </li>
          <li>
            <span aria-hidden="true">03</span>
            <div><strong>Admin controls</strong>
              <p>Review providers, requests, reports and chat access.</p>
            </div>
          </li>
        </ul>

        <div class="security-note"><span aria-hidden="true">✓</span> Account roles are verified during sign in.</div>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.signin-page {
  width: min(1180px, calc(100% - 40px));
  margin: 0 auto;
  padding: clamp(40px, 6vw, 78px) 0;
}

.signin-layout {
  display: grid;
  grid-template-columns: minmax(340px, .88fr) minmax(420px, 1.12fr);
  overflow: hidden;
  border: 1px solid var(--line, #ded2ff);
  border-radius: 32px;
  background: var(--surface, #fff);
  box-shadow: 0 28px 80px rgba(45, 20, 92, .12);
}

.signin-card {
  display: grid;
  gap: 18px;
  padding: clamp(30px, 5vw, 58px);
}

.signin-heading {
  margin-bottom: 6px;
}

.signin-eyebrow,
.showcase-eyebrow {
  margin: 0 0 10px;
  color: #6d2eed;
  font-size: .78rem;
  font-weight: 900;
  letter-spacing: .18em;
  text-transform: uppercase;
}

.signin-heading h1 {
  margin: 0;
  color: var(--text, #170b31);
  font-size: clamp(2rem, 4vw, 3.3rem);
  line-height: 1.03;
  letter-spacing: -.045em;
}

.signin-heading>p:last-child,
.reset-panel>p {
  margin: 14px 0 0;
  color: var(--muted, #6a6280);
  line-height: 1.65;
}

.field-group {
  display: grid;
  gap: 8px;
}

.field-group label {
  color: var(--text, #170b31);
  font-weight: 800;
}

.field-group input {
  width: 100%;
  min-height: 54px;
  box-sizing: border-box;
  border: 1.5px solid var(--line, #d9c9ff);
  border-radius: 15px;
  padding: 0 16px;
  background: var(--surface, #fff);
  color: var(--text, #170b31);
  font: inherit;
}

.field-group input:focus {
  border-color: #6d2eed;
  outline: none;
  box-shadow: 0 0 0 4px rgba(109, 46, 237, .16);
}

.password-field {
  position: relative;
}

.password-field input {
  padding-right: 78px;
}

.password-toggle {
  position: absolute;
  top: 50%;
  right: 10px;
  transform: translateY(-50%);
  border: 0;
  padding: 8px;
  background: transparent;
  color: #6d2eed;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}

.primary-button,
.outline-button {
  min-height: 52px;
  border-radius: 15px;
  padding: 0 20px;
  font: inherit;
  font-weight: 900;
  cursor: pointer;
}

.primary-button {
  border: 1px solid transparent;
  background: linear-gradient(135deg, #5825d6, #7937f3);
  color: #fff;
  box-shadow: 0 12px 28px rgba(100, 42, 224, .25);
}

.primary-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 16px 32px rgba(100, 42, 224, .32);
}

.outline-button {
  border: 1.5px solid var(--line, #d9c9ff);
  background: transparent;
  color: var(--text, #170b31);
}

.forgot-button {
  justify-self: start;
  border: 0;
  padding: 0;
  background: transparent;
  color: #642adf;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}

.reset-panel {
  display: grid;
  gap: 15px;
  border: 1px solid var(--line, #ded2ff);
  border-radius: 18px;
  padding: 20px;
  background: var(--background, #faf8ff);
}

.reset-panel h2 {
  margin: 0;
  color: var(--text, #170b31);
}

.signin-submit {
  margin-top: 4px;
}

.divider {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 12px;
  color: var(--muted, #6a6280);
}

.divider::before,
.divider::after {
  content: '';
  height: 1px;
  background: var(--line, #ded2ff);
}

.google-button {
  display: flex;
  justify-content: center;
  min-height: 44px;
}

.outline-button:disabled {
  cursor: not-allowed;
  opacity: .6;
}

.google-note {
  margin: -8px 0 0;
  color: var(--muted, #6a6280);
  font-size: .9rem;
  text-align: center;
}

.google-error {
  margin: 0;
  border: 1px solid #f3b4b4;
  border-radius: 12px;
  padding: 12px 14px;
  background: #fff1f1;
  color: #a12020;
  font-weight: 700;
  line-height: 1.5;
}

.google-error button {
  border: 0;
  padding: 0 0 0 4px;
  background: transparent;
  color: #642adf;
  font: inherit;
  font-weight: 900;
  text-decoration: underline;
  cursor: pointer;
}

.register-prompt {
  margin: 2px 0 0;
  color: var(--muted, #6a6280);
  text-align: center;
}

.register-prompt button {
  border: 0;
  padding: 4px;
  background: transparent;
  color: #642adf;
  font: inherit;
  font-weight: 900;
  cursor: pointer;
}

.signin-showcase {
  display: grid;
  align-content: center;
  gap: 34px;
  padding: clamp(38px, 6vw, 72px);
  color: #fff;
  background: radial-gradient(circle at 85% 12%, rgba(255, 160, 221, .32), transparent 16rem), radial-gradient(circle at 5% 90%, rgba(154, 106, 255, .4), transparent 18rem), linear-gradient(145deg, #20103c, #4d249e 55%, #7131ee);
}

.signin-showcase .showcase-eyebrow {
  color: #dfd3ff;
}

.signin-showcase h2 {
  max-width: 600px;
  margin: 0;
  font-size: clamp(2rem, 4vw, 3.6rem);
  line-height: 1.04;
  letter-spacing: -.045em;
}

.showcase-description {
  max-width: 570px;
  margin: 18px 0 0;
  color: rgba(255, 255, 255, .78);
  line-height: 1.65;
}

.role-list {
  display: grid;
  gap: 13px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.role-list li {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 16px;
  border: 1px solid rgba(255, 255, 255, .2);
  border-radius: 18px;
  padding: 18px;
  background: rgba(255, 255, 255, .1);
  backdrop-filter: blur(8px);
}

.role-list li>span {
  color: #dbcaff;
  font-weight: 950;
}

.role-list strong {
  font-size: 1.05rem;
}

.role-list p {
  margin: 5px 0 0;
  color: rgba(255, 255, 255, .72);
  line-height: 1.5;
}

.security-note {
  display: flex;
  align-items: center;
  gap: 10px;
  color: rgba(255, 255, 255, .88);
  font-weight: 800;
}

.security-note span {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, .18);
}

button:focus-visible,
input:focus-visible {
  outline: 3px solid #ae8aff;
  outline-offset: 3px;
}

@media (max-width: 900px) {
  .signin-layout {
    grid-template-columns: 1fr;
  }

  .signin-showcase {
    order: -1;
  }
}

@media (max-width: 560px) {
  .signin-page {
    width: min(100% - 24px, 1180px);
    padding: 24px 0 40px;
  }

  .signin-layout {
    border-radius: 22px;
  }

  .signin-card,
  .signin-showcase {
    padding: 26px 20px;
  }

  .signin-showcase h2 {
    font-size: 2rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  * {
    scroll-behavior: auto !important;
    transition: none !important;
  }
}
</style>
