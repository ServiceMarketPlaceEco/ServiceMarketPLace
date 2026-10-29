<script setup>
import { reactive, ref } from 'vue'
import { locations } from '../../data/services'

const emit = defineEmits(['create-account', 'go-signin'])
const error = ref('')

const form = reactive({
  name: '',
  username: '',
  phone: '',
  password: '',
  location: '',
  email: ''
})

const USERNAME_PATTERN = /^[A-Za-z0-9_.-]{3,30}$/

function submitForm() {
  error.value = ''

  if (!form.name.trim()) return error.value = 'Name is required.'
  if (!form.username.trim()) return error.value = 'Username is required.'
  if (!USERNAME_PATTERN.test(form.username.trim())) {
    return error.value = 'Username must be 3-30 characters (letters, numbers, . _ or -), no spaces.'
  }
  if (!form.phone.trim()) return error.value = 'Phone number is required.'
  if (!form.password.trim()) return error.value = 'Password is required.'
  if (!form.location) return error.value = 'Please select your Rajshahi location.'

  emit('create-account', {
    name: form.name.trim(),
    username: form.username.trim(),
    phone: form.phone.trim(),
    password: form.password,
    location: form.location,
    email: form.email.trim(),
    accountMethod: 'phone'
  })
}

</script>

<template>
  <section class="auth-page">
    <form class="auth-card clean-card" @submit.prevent="submitForm">
      <p class="eyebrow">Customer account</p>
      <h2>Create your account</h2>

      <p class="muted">
        Create a Rajshahi customer account. Choose a username you can use to sign in later.
      </p>

      <label>Name * <input v-model="form.name" type="text" placeholder="Example: Sam" /></label>
      <label>Username * <input v-model.trim="form.username" type="text" required autocomplete="username"
          placeholder="Example: sam24" /></label>
      <label>Phone number * <input v-model="form.phone" type="tel" placeholder="Example: 01XXXXXXXXX" /></label>
      <label>Password * <input v-model="form.password" type="password" placeholder="Create a password" /></label>

      <label>
        Location *
        <select v-model="form.location">
          <option value="">Select your area</option>
          <option v-for="area in locations" :key="area.id" :value="area.name">
            {{ area.name }} — {{ area.area }}
          </option>
        </select>
      </label>

      <label>Email optional <input v-model="form.email" type="email" placeholder="Optional email address" /></label>

      <p v-if="error" class="error-text">{{ error }}</p>

      <button class="primary" type="submit">Create account</button>
      <button class="link-btn" type="button" @click="emit('go-signin')">Already have an account?</button>
    </form>
  </section>
</template>
