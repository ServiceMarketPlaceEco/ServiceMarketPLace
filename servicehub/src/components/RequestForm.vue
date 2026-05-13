<script setup>
// request form component: validates the booking form before App.vue stores the request.
import { computed, reactive, ref, watch } from 'vue'

const props = defineProps({
  selectedService: { type: Object, default: null },
  selectedTask: { type: String, default: '' },
  selectedLocation: { type: String, default: 'Rajshahi City' },
  locations: { type: Array, required: true }
})

const emit = defineEmits(['back', 'change-location', 'submit-request'])

// local form state is grouped in one reactive object for easier validation and submission.
const form = reactive({
  city: props.selectedLocation,
  area: '',
  type: '',
  date: new Date().toISOString().slice(0, 10),
  time: '',
  budget: '',
  payment: 'Cash on delivery',
  urgency: 'Flexible',
  address: '',
  phone: '',
  details: ''
})

// user-facing validation errors are rendered near the submit button.
const error = ref('')

// Keeps the form city synced with the location displayed in the navbar.
watch(() => props.selectedLocation, (newLocation) => {
  form.city = newLocation
})

// display summary uses selected service/task, but still works if the user lands here directly.
const serviceTitle = computed(() => props.selectedService?.title || 'Selected service')
const taskTitle = computed(() => props.selectedTask || 'Custom service request')

// validateForm prevents blank or incomplete requests from entering dashboard state.
function validateForm() {
  if (!form.area || !form.type || !form.time || !form.budget || !form.address || !form.phone || !form.details) {
    error.value = 'please complete all required fields before submitting.'
    return false
  }
  if (String(form.phone).replace(/\D/g, '').length < 10) {
    error.value = 'please enter a valid phone number.'
    return false
  }
  error.value = ''
  return true
}

// submitForm emits a clean payload only after validation passes.
function submitForm() {
  if (!validateForm()) return
  emit('submit-request', {
    serviceTitle: serviceTitle.value,
    task: taskTitle.value,
    city: form.city,
    area: form.area,
    type: form.type,
    date: form.date,
    time: form.time,
    budget: form.budget,
    payment: form.payment,
    urgency: form.urgency,
    address: form.address,
    phone: form.phone,
    details: form.details
  })
}
</script>

<template>
  <section class="page-section request-page">
    <button class="back-pill" @click="$emit('back')">Back to services</button>

    <div class="request-header clean-card">
      <div>
        <p class="eyebrow">Service request</p>
        <h2>Tell us about your task</h2>
        <p>Choose your location, schedule and task details. Service Hub will match your request with suitable local
          helpers.</p>
      </div>
      <aside>
        <span>{{ serviceTitle }}</span>
        <strong>{{ taskTitle }}</strong>
        <small>{{ form.city }} local request</small>
      </aside>
    </div>

    <form class="request-form clean-card" @submit.prevent="submitForm">
      <section class="form-section">
        <span class="step-number">01</span>
        <div>
          <h3>Location and service</h3>
          <p>Set the area first so the provider understands where the task is needed.</p>
        </div>
        <div class="form-grid">
          <label>City / service area<select v-model="form.city" disabled>
              <option v-for="location in locations" :key="location">{{ location }}</option>
            </select></label>
          <label>Neighbourhood<select v-model="form.area">
              <option value="">Select area</option>
              <option>Shaheb Bazar</option>
              <option>Boalia</option>
              <option>Laxmipur</option>
              <option>Motihar</option>
              <option>Kazla</option>
            </select></label>
          <label>Service option<select>
              <option>{{ taskTitle }}</option>
            </select></label>
          <label>Property / request type<select v-model="form.type">
              <option value="">Select type</option>
              <option>Home</option>
              <option>Apartment</option>
              <option>Shop</option>
              <option>Office</option>
              <option>Pickup only</option>
            </select></label>
        </div>
      </section>

      <section class="form-section">
        <span class="step-number">02</span>
        <div>
          <h3>Schedule and payment</h3>
          <p>Select a preferred date, time and payment method.</p>
        </div>
        <div class="form-grid">
          <label>Preferred date<input v-model="form.date" type="date" /></label>
          <label>Preferred time<select v-model="form.time">
              <option value="">Select time</option>
              <option>Morning</option>
              <option>Afternoon</option>
              <option>Evening</option>
              <option>Flexible</option>
            </select></label>
          <label>Estimated budget<input v-model="form.budget" type="number" min="1" placeholder="Budget in ৳" /></label>
          <label>Payment method<select v-model="form.payment">
              <option>Cash on delivery</option>
              <option>bKash</option>
              <option>Nagad</option>
            </select></label>
          <label>Urgency<select v-model="form.urgency">
              <option>Flexible</option>
              <option>Today</option>
              <option>Tomorrow</option>
              <option>This week</option>
            </select></label>
        </div>
      </section>

      <section class="form-section">
        <span class="step-number">03</span>
        <div>
          <h3>Contact and task notes</h3>
          <p>Give enough detail so helpers can price and prepare correctly.</p>
        </div>
        <div class="form-grid">
          <label>Full address<input v-model="form.address" placeholder="House, road, landmark" /></label>
          <label>Phone number<input v-model="form.phone" placeholder="Example: 017XXXXXXXX" /></label>
          <label class="full">Request details<textarea v-model="form.details" rows="5"
              placeholder="Describe what you need, item list, pickup location, room size, learning goal, or special instructions..."></textarea></label>
        </div>
      </section>

      <div class="form-actions">
        <p v-if="error" class="error-text">{{ error }}</p>
        <button type="button" class="secondary" @click="$emit('change-location')">Change location</button>
        <button type="submit" class="primary">Submit request</button>
      </div>
    </form>
  </section>
</template>
