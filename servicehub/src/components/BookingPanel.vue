<template>
  <div class="booking-overlay">
    <aside class="booking-panel">
      <div class="booking-header">
        <div>
          <p class="eyebrow">Step {{ step }} of 3</p>
          <h3>{{ service.title }}</h3>
          <p>Base price: ৳{{ service.price }} · Rajshahi service</p>
        </div>
        <button class="close-btn" @click="$emit('close')">×</button>
      </div>

      <div class="step-bar">
        <span :class="{ active: step >= 1 }"></span>
        <span :class="{ active: step >= 2 }"></span>
        <span :class="{ active: step >= 3 }"></span>
      </div>

      <form class="booking-body" @submit.prevent="handleSubmit">
        <section v-if="step === 1" class="booking-section">
          <h4>Contact details</h4>

          <label>Full name *</label>
          <input v-model.trim="form.fullName" class="booking-input" placeholder="Your full name" />

          <label>Phone number *</label>
          <input v-model.trim="form.phone" class="booking-input" placeholder="e.g. 017XXXXXXXX" />

          <label>Rajshahi area *</label>
          <select v-model="form.area" class="booking-input">
            <option value="">Select area</option>
            <option v-for="area in areas" :key="area">{{ area }}</option>
          </select>

          <label>Full address *</label>
          <textarea v-model.trim="form.address" class="booking-input booking-textarea" placeholder="House, road, landmark"></textarea>
        </section>

        <section v-if="step === 2" class="booking-section">
          <h4>Schedule and task details</h4>

          <div class="booking-two-col">
            <div>
              <label>Date *</label>
              <input v-model="form.date" type="date" class="booking-input" />
            </div>
            <div>
              <label>Time *</label>
              <input v-model="form.time" type="time" class="booking-input" />
            </div>
          </div>

          <label>Task details *</label>
          <textarea
            v-model.trim="form.notes"
            class="booking-input booking-textarea"
            placeholder="Example: Buy vegetables from Shaheb Bazar and call before replacing any item."
          ></textarea>

          <label>Urgency *</label>
          <select v-model="form.urgency" class="booking-input">
            <option value="">Select urgency</option>
            <option>Today</option>
            <option>Tomorrow</option>
            <option>This week</option>
          </select>
        </section>

        <section v-if="step === 3" class="booking-section">
          <h4>Confirm booking</h4>

          <label>Payment method *</label>
          <select v-model="form.payment" class="booking-input">
            <option value="">Select payment</option>
            <option>Cash after service</option>
            <option>bKash</option>
            <option>Nagad</option>
          </select>

          <div class="pricing-box">
            <div class="pricing-row">
              <span>Service price</span>
              <strong>৳{{ service.price }}</strong>
            </div>
            <div class="pricing-row">
              <span>Service Hub platform fee</span>
              <strong>৳30</strong>
            </div>
            <div class="pricing-row total">
              <span>Total estimate</span>
              <strong>৳{{ total }}</strong>
            </div>
          </div>

          <p class="small-note">
            Final cost may change if the task becomes larger than described. Helper should confirm before extra cost.
          </p>
        </section>

        <p v-if="error" class="error-text">{{ error }}</p>
      </form>

      <div class="booking-footer">
        <button v-if="step > 1" class="secondary-btn" @click="step--">Back</button>
        <button v-if="step < 3" class="confirm-btn" @click="nextStep">Next</button>
        <button v-else class="confirm-btn" @click="handleSubmit">Confirm booking</button>
      </div>
    </aside>
  </div>
</template>

<script>
export default {
  name: 'BookingPanel',
  props: {
    service: { type: Object, required: true },
    areas: { type: Array, required: true }
  },
  emits: ['close', 'confirm-booking'],
  data() {
    return {
      step: 1,
      error: '',
      form: {
        fullName: '',
        phone: '',
        area: '',
        address: '',
        date: '',
        time: '',
        notes: '',
        urgency: '',
        payment: ''
      }
    }
  },
  computed: {
    total() {
      return this.service.price + 30
    }
  },
  methods: {
    validateStep() {
      this.error = ''

      if (this.step === 1) {
        if (!this.form.fullName || !this.form.phone || !this.form.area || !this.form.address) {
          this.error = 'Please fill in all contact and address fields.'
          return false
        }
      }

      if (this.step === 2) {
        if (!this.form.date || !this.form.time || !this.form.notes || !this.form.urgency) {
          this.error = 'Please complete the schedule and task details.'
          return false
        }
      }

      if (this.step === 3) {
        if (!this.form.payment) {
          this.error = 'Please select a payment method.'
          return false
        }
      }

      return true
    },
    nextStep() {
      if (this.validateStep()) this.step++
    },
    handleSubmit() {
      if (!this.validateStep()) return
      this.$emit('confirm-booking', { ...this.form })
    }
  }
}
</script>
