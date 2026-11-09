<script setup>
// Admin accounts: add admins, switch accounts on or off, change your own
// password. Before launch the seeded admin@servicehub.com (whose password is
// in the README) has to be replaced, and this screen walks through that.
import { computed, onMounted, reactive, ref } from 'vue'
import * as api from '../../services/api'

const SEEDED_EMAIL = 'admin@servicehub.com'
const PASSWORD_RULE = /((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/

const props = defineProps({
  currentUserId: { type: String, default: '' }
})

const admins = ref([])
const loading = ref(true)
const error = ref('')
const notice = ref('')
const busy = ref({})

const form = reactive({ name: '', email: '', password: '', confirm: '', superAdmin: true })
const formError = ref('')
const saving = ref(false)

const pw = reactive({ current: '', next: '', confirm: '' })
const pwError = ref('')
const pwSaving = ref(false)

const me = computed(() => admins.value.find(a => a.id === props.currentUserId) || null)
const iAmSuper = computed(() => me.value?.role === 'super_admin')
// the demo admin only exists in development databases (seed 005), where every
// laptop has it on purpose, so the warning only shows on a built site
const WARN_ABOUT_DEMO_ADMIN = import.meta.env.PROD || import.meta.env.MODE === 'test'
const seededStillOn = computed(() =>
  WARN_ABOUT_DEMO_ADMIN && admins.value.some(a => a.email === SEEDED_EMAIL && a.isActive))
const signedInAsSeeded = computed(() => me.value?.email === SEEDED_EMAIL)

function roleLabel(role) {
  return { super_admin: 'Super admin', admin: 'Admin', moderator: 'Moderator' }[role] || role
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    admins.value = await api.getAdmins()
  } catch (err) {
    error.value = err.message || 'Could not load the admin accounts'
  } finally {
    loading.value = false
  }
}

function checkPassword(password, confirm) {
  if (password.length < 8) return 'Use at least 8 characters.'
  if (!PASSWORD_RULE.test(password)) return 'Use uppercase, lowercase and a number or symbol.'
  if (password !== confirm) return 'The two passwords do not match.'
  return ''
}

async function addAdmin() {
  formError.value = ''
  notice.value = ''
  if (!form.name.trim() || !form.email.trim()) {
    formError.value = 'Enter a name and an email.'
    return
  }
  const problem = checkPassword(form.password, form.confirm)
  if (problem) {
    formError.value = problem
    return
  }
  saving.value = true
  try {
    await api.createAdmin({
      name: form.name.trim(),
      email: form.email.trim(),
      password: form.password,
      role: iAmSuper.value && form.superAdmin ? 'super_admin' : 'admin'
    })
    notice.value = `${form.name.trim()} can now sign in with ${form.email.trim()}.`
    Object.assign(form, { name: '', email: '', password: '', confirm: '', superAdmin: true })
    await load()
  } catch (err) {
    formError.value = err.message || 'Could not add the admin.'
  } finally {
    saving.value = false
  }
}

async function setActive(admin, active) {
  error.value = ''
  notice.value = ''
  busy.value = { ...busy.value, [admin.id]: true }
  try {
    if (active) await api.activateAdmin(admin.id)
    else await api.deactivateAdmin(admin.id)
    notice.value = active ? `${admin.name} is switched on again.` : `${admin.name} is switched off and signed out.`
    await load()
  } catch (err) {
    error.value = err.message || 'Could not change this account.'
  } finally {
    busy.value = { ...busy.value, [admin.id]: false }
  }
}

async function changePassword() {
  pwError.value = ''
  notice.value = ''
  if (!pw.current) {
    pwError.value = 'Enter your current password.'
    return
  }
  const problem = checkPassword(pw.next, pw.confirm)
  if (problem) {
    pwError.value = problem
    return
  }
  pwSaving.value = true
  try {
    await api.changeMyAdminPassword(pw.current, pw.next)
    Object.assign(pw, { current: '', next: '', confirm: '' })
    notice.value = 'Your password has been changed.'
  } catch (err) {
    pwError.value = err.message || 'Could not change your password.'
  } finally {
    pwSaving.value = false
  }
}

onMounted(load)
</script>

<template>
  <section v-if="seededStillOn" class="ops-panel launch-warning" role="status">
    <h2>Switch off the demo admin before launch</h2>
    <p>
      The demo admin ({{ SEEDED_EMAIL }}) is switched on, and its password is in the README, so anyone could sign in
      with it. It should never exist on a live site.
    </p>
    <ol>
      <li>Add your own admin below with <strong>Super admin</strong> ticked.</li>
      <li>Log out and sign in with the new account.</li>
      <li>Come back here and choose <strong>Switch off</strong> next to {{ SEEDED_EMAIL }}.</li>
    </ol>
    <p v-if="signedInAsSeeded" class="muted">You are signed in as the demo admin right now.</p>
  </section>

  <p v-if="notice" class="success-text" role="status">{{ notice }}</p>
  <p v-if="error" class="error-text" role="alert">{{ error }}</p>

  <section class="ops-panel">
    <div class="panel-heading">
      <h2>Admin accounts</h2><span>{{ admins.filter(a => a.isActive).length }} active</span>
    </div>
    <div v-if="loading" class="empty-state">Loading admins…</div>
    <div v-else class="responsive-table">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Access</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="admin in admins" :key="admin.id">
            <td><strong>{{ admin.name }}</strong><small v-if="admin.id === currentUserId">You</small></td>
            <td>{{ admin.email }}</td>
            <td>{{ roleLabel(admin.role) }}</td>
            <td><span class="status-pill" :class="admin.isActive ? 'active' : 'blocked'">{{ admin.isActive ? 'Active' :
              'Switched off' }}</span></td>
            <td class="row-actions">
              <span v-if="admin.id === currentUserId" class="muted">—</span>
              <button v-else-if="admin.isActive" class="secondary small" :disabled="busy[admin.id]"
                @click="setActive(admin, false)">Switch off</button>
              <button v-else class="success small" :disabled="busy[admin.id]"
                @click="setActive(admin, true)">Switch on</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <section class="ops-panel">
    <h2>Add an admin</h2>
    <p class="muted">They sign in with this email and password, and can change the password themselves afterwards.</p>
    <form class="settings-grid" @submit.prevent="addAdmin">
      <label>Name<input v-model="form.name" autocomplete="off" /></label>
      <label>Email<input v-model="form.email" type="email" autocomplete="off" /></label>
      <label>Password<input v-model="form.password" type="password" autocomplete="new-password" /></label>
      <label>Confirm password<input v-model="form.confirm" type="password" autocomplete="new-password" /></label>
      <label v-if="iAmSuper" class="full checkbox-row">
        <input v-model="form.superAdmin" type="checkbox" />
        Super admin (can add and switch off other admins)
      </label>
      <p v-if="formError" class="error-text full">{{ formError }}</p>
      <div class="form-actions full"><button class="primary" type="submit" :disabled="saving">{{ saving ? 'Adding…' :
        'Add admin' }}</button></div>
    </form>
  </section>

  <section class="ops-panel">
    <h2>Change my password</h2>
    <form class="settings-grid" @submit.prevent="changePassword">
      <label class="full">Current password<input v-model="pw.current" type="password"
          autocomplete="current-password" /></label>
      <label>New password<input v-model="pw.next" type="password" autocomplete="new-password" /></label>
      <label>Confirm new password<input v-model="pw.confirm" type="password" autocomplete="new-password" /></label>
      <p v-if="pwError" class="error-text full">{{ pwError }}</p>
      <div class="form-actions full"><button class="primary" type="submit" :disabled="pwSaving">{{ pwSaving ?
        'Saving…' : 'Change password' }}</button></div>
    </form>
  </section>
</template>

<style scoped>
.launch-warning {
  border: 1px solid var(--warning);
  background: var(--warning-bg);
}

.launch-warning h2 {
  color: var(--warning);
}

.launch-warning ol {
  margin: 8px 0;
  padding-left: 20px;
}

.checkbox-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.checkbox-row input {
  width: auto;
}

.success-text {
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  background: var(--success-bg);
  color: var(--success);
}

td small {
  display: block;
  color: var(--muted);
}

@media (max-width: 700px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }
}
</style>
