<script setup>
import { reactive, ref } from 'vue'

// Events handled by App.vue.
const emit = defineEmits([
  'sign-in',
  'go-register',
  'forgot-password',
  'reset-password'
])

// Users enter only their username/phone number and password.
// The backend will determine whether they are a customer,
// provider or administrator.
const form = reactive({
  identifier: '',
  password: ''
})

const showReset = ref(false)

const resetForm = reactive({
  email: '',
  token: '',
  newPassword: ''
})

// Send the entered credentials to App.vue.
function submit() {
  emit('sign-in', {
    identifier: form.identifier.trim(),
    password: form.password
  })
}

// Request a password-reset email.
// Account type is not sent because the backend detects the account.
function requestReset() {
  const email = resetForm.email.trim()

  if (!email) return

  emit('forgot-password', { email })
}

// Submit the reset token and new password.
function submitReset() {
  const token = resetForm.token.trim()
  const newPassword = resetForm.newPassword.trim()

  if (!token || !newPassword) return

  emit('reset-password', {
    token,
    newPassword
  })
}
</script>