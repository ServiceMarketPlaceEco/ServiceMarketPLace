<script setup>
// A customer's own account settings: name and address, password, and closing
// the account. Before this customers had no way to change anything and the
// privacy policy told them to email instead.
//
// The phone number is not editable here, because it was confirmed with a
// text message code at sign-up and changing it would need a new code.
import { reactive, ref, watch } from 'vue'
import * as api from '../../services/api'

const PASSWORD_RULE = /((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/

const props = defineProps({
  customer: { type: Object, default: null }
})

const emit = defineEmits(['profile-updated', 'account-closed'])

const profile = reactive({ name: '', address: '' })
const profileMessage = ref('')
const profileError = ref('')
const savingProfile = ref(false)

const pw = reactive({ current: '', next: '', confirm: '' })
const pwMessage = ref('')
const pwError = ref('')
const savingPw = ref(false)

const closing = reactive({ open: false, password: '' })
const closeError = ref('')
const closingBusy = ref(false)

watch(() => props.customer, customer => {
  profile.name = customer?.name || ''
  profile.address = customer?.location || customer?.address || ''
}, { immediate: true })

async function saveProfile() {
  profileMessage.value = ''
  profileError.value = ''
  if (!profile.name.trim()) {
    profileError.value = 'Enter your name.'
    return
  }
  savingProfile.value = true
  try {
    const updated = await api.updateCustomerProfile({ name: profile.name.trim(), address: profile.address.trim() })
    emit('profile-updated', updated)
    profileMessage.value = 'Your details are saved.'
  } catch (err) {
    profileError.value = err.message || 'Could not save your details.'
  } finally {
    savingProfile.value = false
  }
}

async function changePassword() {
  pwMessage.value = ''
  pwError.value = ''
  if (!pw.current) {
    pwError.value = 'Enter your current password.'
    return
  }
  if (pw.next.length < 8) {
    pwError.value = 'Use at least 8 characters.'
    return
  }
  if (!PASSWORD_RULE.test(pw.next)) {
    pwError.value = 'Use uppercase, lowercase and a number or symbol.'
    return
  }
  if (pw.next !== pw.confirm) {
    pwError.value = 'The two passwords do not match.'
    return
  }
  savingPw.value = true
  try {
    await api.changeCustomerPassword({ currentPassword: pw.current, newPassword: pw.next })
    Object.assign(pw, { current: '', next: '', confirm: '' })
    pwMessage.value = 'Your password has been changed.'
  } catch (err) {
    pwError.value = err.message || 'Could not change your password.'
  } finally {
    savingPw.value = false
  }
}

async function closeAccount() {
  closeError.value = ''
  if (!closing.password) {
    closeError.value = 'Enter your password to confirm.'
    return
  }
  closingBusy.value = true
  try {
    await api.closeCustomerAccount(closing.password)
    emit('account-closed')
  } catch (err) {
    closeError.value = err.message || 'Could not close your account.'
  } finally {
    closingBusy.value = false
  }
}
</script>

<template>
  <div class="customer-settings">
    <section class="clean-card settings-card">
      <h3>Your details</h3>
      <form class="settings-grid" @submit.prevent="saveProfile">
        <label>Name<input v-model="profile.name" autocomplete="name" maxlength="255" /></label>
        <label>Phone<input :value="customer?.phone || ''" disabled />
          <small class="muted">Confirmed by text at sign-up. Message the admin team to change it.</small></label>
        <label class="full">Address or area<input v-model="profile.address" autocomplete="street-address" /></label>
        <p v-if="profileError" class="error-text full" role="alert">{{ profileError }}</p>
        <p v-if="profileMessage" class="settings-ok full" role="status">{{ profileMessage }}</p>
        <div class="form-actions full"><button class="primary" type="submit" :disabled="savingProfile">
            {{ savingProfile ? 'Saving…' : 'Save details' }}</button></div>
      </form>
    </section>

    <section class="clean-card settings-card">
      <h3>Change password</h3>
      <form class="settings-grid" @submit.prevent="changePassword">
        <label class="full">Current password<input v-model="pw.current" type="password"
            autocomplete="current-password" /></label>
        <label>New password<input v-model="pw.next" type="password" autocomplete="new-password" /></label>
        <label>Confirm new password<input v-model="pw.confirm" type="password" autocomplete="new-password" /></label>
        <p v-if="pwError" class="error-text full" role="alert">{{ pwError }}</p>
        <p v-if="pwMessage" class="settings-ok full" role="status">{{ pwMessage }}</p>
        <div class="form-actions full"><button class="primary" type="submit" :disabled="savingPw">
            {{ savingPw ? 'Saving…' : 'Change password' }}</button></div>
      </form>
    </section>

    <section class="clean-card settings-card danger-zone">
      <h3>Close my account</h3>
      <p class="muted">
        Closing your account removes your name, phone number, email and address, cancels requests that have not been
        assigned yet, and signs you out for good. Past bookings and reviews stay, without your details. This cannot
        be undone.
      </p>
      <button v-if="!closing.open" class="secondary" type="button" @click="closing.open = true">Close my account</button>
      <form v-else class="settings-grid" @submit.prevent="closeAccount">
        <label class="full">Enter your password to confirm<input v-model="closing.password" type="password"
            autocomplete="current-password" /></label>
        <p v-if="closeError" class="error-text full" role="alert">{{ closeError }}</p>
        <div class="form-actions full">
          <button class="secondary" type="button" @click="closing.open = false; closing.password = ''">Keep my
            account</button>
          <button class="danger" type="submit" :disabled="closingBusy">
            {{ closingBusy ? 'Closing…' : 'Close account for good' }}</button>
        </div>
      </form>
    </section>
  </div>
</template>

<style scoped>
.customer-settings {
  display: grid;
  gap: 20px;
}

.settings-card {
  padding: 24px;
}

.settings-card h3 {
  margin: 0 0 14px;
}

.settings-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  align-items: start;
}

.settings-grid label {
  display: grid;
  align-content: start;
  gap: 6px;
  font-weight: 600;
}

.settings-grid .full {
  grid-column: 1 / -1;
}

.settings-grid small {
  font-weight: 400;
}

.settings-ok {
  margin: 0;
  color: var(--success);
}

.danger-zone {
  border: 1px solid var(--danger);
}

.form-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

@media (max-width: 700px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }
}
</style>
