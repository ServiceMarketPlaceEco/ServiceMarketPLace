<template>
  <section class="request-page">
    <button class="back-btn" @click="$emit('back')">← Back</button>

    <div class="request-progress">
      <div class="active-step">1. Describe your request</div>
      <div>2. Contact details</div>
      <div>3. Submit</div>
    </div>

    <div class="request-layout">
      <aside class="request-summary">
        <h3>{{ selectedService?.title }}</h3>
        <p>{{ selectedTask }}</p>
        <span>Rajshahi local request</span>
      </aside>

      <form class="request-form" @submit.prevent="submitForm">
        <h1>Tell us about your task</h1>
        <p>
          These details help Service Hub match your request with suitable local helpers.
        </p>

        <label>
          Your location
          <input v-model="form.area" type="text" placeholder="Example: Shaheb Bazar, Rajshahi" required />
        </label>

        <label>
          Preferred date
          <input v-model="form.date" type="date" required />
        </label>

        <label>
          Estimated budget
          <input v-model="form.budget" type="number" placeholder="Budget in ৳" required />
        </label>

        <label>
          Request details
          <textarea
            v-model="form.details"
            placeholder="Describe what you need, item list, pickup location, special instructions..."
            required
          ></textarea>
        </label>

        <div class="voice-placeholder">
          🎙️ AI voice search will be added later so users can speak their request.
        </div>

        <button type="submit">Continue</button>
      </form>
    </div>
  </section>
</template>

<script setup>
import { reactive } from 'vue'

defineProps({
  selectedService: Object,
  selectedTask: String
})

const emit = defineEmits(['submit-request', 'back'])

const form = reactive({
  area: '',
  date: '',
  budget: '',
  details: ''
})

function submitForm() {
  emit('submit-request', { ...form })

  form.area = ''
  form.date = ''
  form.budget = ''
  form.details = ''
}
</script>