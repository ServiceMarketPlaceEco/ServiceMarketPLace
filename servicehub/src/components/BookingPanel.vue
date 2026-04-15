<template>
  <div v-if="isOpen && service" class="booking-overlay" @click.self="closePanel">
    <aside class="booking-panel">
      <div class="booking-header">
        <div>
          <h3>Book Service</h3>
          <p>{{ service.title }}</p>
        </div>
        <button class="close-btn" @click="closePanel">✕</button>
      </div>

      <div class="booking-body" v-if="!bookingConfirmed">
        <div class="booking-section">
          <label class="booking-label">Service</label>
          <div class="location-box">
            <div>
              <strong>{{ service.title }}</strong>
              <p>{{ service.provider }}</p>
            </div>
            <span>{{ formatPrice(service) }}</span>
          </div>
        </div>

        <div class="booking-section">
          <label class="booking-label">Booking type</label>
          <div class="booking-type-grid">
            <button
              type="button"
              class="booking-type-card"
              :class="{ active: bookingType === 'one-time' }"
              @click="bookingType = 'one-time'"
            >
              One-time
              <span>Single booking</span>
            </button>

            <button
              type="button"
              class="booking-type-card"
              :class="{ active: bookingType === 'recurring' }"
              @click="bookingType = 'recurring'"
            >
              Recurring
              <span>Repeat service</span>
            </button>
          </div>
        </div>

        <div class="booking-section booking-two-col">
          <div>
            <label class="booking-label">Date</label>
            <input v-model="bookingDate" type="date" class="booking-input" />
          </div>

          <div>
            <label class="booking-label">Time</label>
            <input v-model="bookingTime" type="time" class="booking-input" />
          </div>
        </div>

        <div class="booking-section" v-if="service.pricingType === 'hourly'">
          <label class="booking-label">Hours needed</label>
          <input
            v-model.number="hours"
            type="number"
            min="1"
            class="booking-input"
          />
        </div>

        <div class="booking-section">
          <label class="booking-label">Address</label>
          <input
            v-model="address"
            type="text"
            class="booking-input"
            placeholder="Enter your service address"
          />
        </div>

        <div class="booking-section">
          <label class="booking-label">Additional notes</label>
          <textarea
            v-model="notes"
            class="booking-input booking-textarea"
            placeholder="Describe the issue or request"
          ></textarea>
        </div>

        <div class="booking-section">
          <label class="booking-label">Pricing summary</label>
          <div class="pricing-box">
            <div class="pricing-row">
              <span>Pricing model</span>
              <span>{{ pricingModelLabel }}</span>
            </div>

            <div class="pricing-row" v-if="service.pricingType === 'hourly'">
              <span>Rate</span>
              <span>{{ formatCurrency(service.price) }}/hr</span>
            </div>

            <div class="pricing-row" v-if="service.pricingType === 'hourly'">
              <span>Hours</span>
              <span>{{ hours }}</span>
            </div>

            <div class="pricing-row" v-if="service.pricingType === 'estimated'">
              <span>Estimated range</span>
              <span>{{ formatPrice(service) }}</span>
            </div>

            <div class="pricing-row" v-if="service.pricingType === 'fixed'">
              <span>Service price</span>
              <span>{{ formatCurrency(service.price) }}</span>
            </div>

            <div class="pricing-row total">
              <span>Total</span>
              <span>{{ totalDisplay }}</span>
            </div>
          </div>

          <p v-if="service.pricingType === 'estimated'" class="error-text">
            Final price may vary after inspection.
          </p>
        </div>
      </div>

      <div v-else class="booking-body">
        <div class="success-state">
          <h3>Booking confirmed</h3>
          <p>Your request has been submitted successfully.</p>

          <div class="success-summary">
            <p><strong>Service:</strong> {{ service.title }}</p>
            <p><strong>Date:</strong> {{ bookingDate || 'Not selected' }}</p>
            <p><strong>Time:</strong> {{ bookingTime || 'Not selected' }}</p>
            <p><strong>Address:</strong> {{ address || 'Not provided' }}</p>
            <p><strong>Total:</strong> {{ totalDisplay }}</p>
          </div>

          <button class="confirm-btn" @click="closePanel">Done</button>
        </div>
      </div>

      <div class="booking-footer" v-if="!bookingConfirmed">
        <button class="confirm-btn" @click="submitBooking">Confirm Booking</button>
      </div>
    </aside>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  service: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['close', 'submit-booking'])

const bookingType = ref('one-time')
const bookingDate = ref('')
const bookingTime = ref('')
const address = ref('')
const notes = ref('')
const hours = ref(2)
const bookingConfirmed = ref(false)

function formatCurrency(value) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(value)
}

function formatPrice(service) {
  if (!service) return ''

  if (service.pricingType === 'hourly') {
    return `${formatCurrency(service.price)}/hr`
  }

  if (service.pricingType === 'estimated') {
    return `${formatCurrency(service.basePrice)}–${formatCurrency(service.maxPrice)}`
  }

  return formatCurrency(service.price)
}

const pricingModelLabel = computed(() => {
  if (!props.service) return ''

  if (props.service.pricingType === 'hourly') return 'Hourly'
  if (props.service.pricingType === 'estimated') return 'Estimated'
  return 'Fixed'
})

const estimatedTotal = computed(() => {
  if (!props.service) return 0

  if (props.service.pricingType === 'hourly') {
    return props.service.price * Math.max(1, Number(hours.value || 1))
  }

  if (props.service.pricingType === 'estimated') {
    return props.service.basePrice
  }

  return props.service.price
})

const totalDisplay = computed(() => {
  if (!props.service) return ''

  if (props.service.pricingType === 'estimated') {
    return `${formatCurrency(props.service.basePrice)}+`
  }

  return formatCurrency(estimatedTotal.value)
})

function resetForm() {
  bookingType.value = 'one-time'
  bookingDate.value = ''
  bookingTime.value = ''
  address.value = ''
  notes.value = ''
  hours.value = 2
  bookingConfirmed.value = false
}

function closePanel() {
  emit('close')
}

function submitBooking() {
  bookingConfirmed.value = true

  emit('submit-booking', {
    service: props.service,
    bookingType: bookingType.value,
    bookingDate: bookingDate.value,
    bookingTime: bookingTime.value,
    address: address.value,
    notes: notes.value,
    hours: hours.value,
    total: totalDisplay.value
  })
}

watch(
  () => props.isOpen,
  (newValue) => {
    if (newValue) {
      resetForm()
    }
  }
)

watch(
  () => props.service,
  () => {
    resetForm()
  }
)
</script>