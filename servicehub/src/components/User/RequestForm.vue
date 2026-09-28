<script setup>
import { computed, reactive } from 'vue'
import { formatBDT } from '../../data/services'

const props = defineProps({
  service: Object,
  customer: Object
})

defineEmits(['submit-request', 'back'])

const upfrontPayment = computed(() => props.service?.upfrontPayment || null)
const requiresUpfrontPayment = computed(() => Boolean(upfrontPayment.value?.required))

const form = reactive({
  location: props.customer?.location || 'Rajshahi City',
  preferredDate: '',
  preferredTime: '',
  budget: props.service?.price || '',
  details: '',
  urgency: 'standard'
})

const priceLabel = computed(() => formatBDT(props.service?.price))
</script>

<template>
  <section class="page-section request-page upgraded-request-page">
    <button class="back-pill" type="button" @click="$emit('back')">← Back to services</button>

    <div class="request-header clean-card request-hero-card">
      <div>
        <p class="eyebrow">Create request</p>
        <h2>{{ service?.title }}</h2>
        <p>
          Base price starts from {{ priceLabel }}. Add the task location, schedule and details so admin can assign the right provider.
        </p>
      </div>

      <aside>
        <span>Request owner</span>
        <strong>{{ customer?.name }}</strong>
        <small>{{ customer?.email }}</small>
      </aside>
    </div>

    <form
      class="request-form clean-card"
      @submit.prevent="$emit('submit-request', {
        ...form,
        serviceId: service.id,
        serviceTitle: service.title,
        customerId: customer.id,
        customerName: customer.name,
        needsUpfrontPayment: requiresUpfrontPayment,
        upfrontAmount: requiresUpfrontPayment ? upfrontPayment.amount : 0,
        bankName: requiresUpfrontPayment ? upfrontPayment.bankName : '',
        accountName: requiresUpfrontPayment ? upfrontPayment.accountName : '',
        accountNumber: requiresUpfrontPayment ? upfrontPayment.accountNumber : '',
        paymentNote: requiresUpfrontPayment ? upfrontPayment.note : '',
        paymentStatus: requiresUpfrontPayment ? 'bank-transfer-required' : 'pay-after-service'
      })"
    >
      <section class="form-section">
        <div class="step-number">1</div>
        <div>
          <h3>Location and schedule</h3>
          <p>Tell the provider where and when the job should happen.</p>
        </div>

        <div class="form-grid">
          <label class="full">
            Area / address
            <input v-model="form.location" required placeholder="Boalia, Motihar, Laxmipur..." />
          </label>

          <label>
            Preferred date
            <input v-model="form.preferredDate" type="date" required />
          </label>

          <label>
            Preferred time
            <input v-model="form.preferredTime" type="time" />
          </label>

          <label>
            Budget
            <input v-model="form.budget" type="number" min="0" required placeholder="৳" />
          </label>

          <label>
            Urgency
            <select v-model="form.urgency">
              <option value="standard">Standard</option>
              <option value="urgent">Urgent</option>
              <option value="flexible">Flexible timing</option>
            </select>
          </label>
        </div>
      </section>

      <section class="form-section">
        <div class="step-number">2</div>
        <div>
          <h3>Task details</h3>
          <p>Clear details help admin approve and assign faster.</p>
        </div>

        <div class="form-grid">
          <label class="full">
            Details
            <textarea
              v-model="form.details"
              required
              placeholder="Example: moving from ground floor, two boxes, one table, lift access available..."
            ></textarea>
          </label>
        </div>
      </section>

      <section class="form-section payment-section">
        <div class="step-number">3</div>
        <div>
          <h3>Provider payment rule</h3>
          <p>This is automatically loaded from the selected service.</p>
        </div>

        <div v-if="requiresUpfrontPayment" class="payment-summary-card">
          <strong>Upfront bank payment required</strong>
          <p>The provider requires a deposit before this service can be confirmed.</p>

          <div class="payment-detail-grid">
            <span>Deposit amount</span>
            <strong>{{ formatBDT(upfrontPayment.amount) }}</strong>

            <span>Bank</span>
            <strong>{{ upfrontPayment.bankName }}</strong>

            <span>Account name</span>
            <strong>{{ upfrontPayment.accountName }}</strong>

            <span>Account number</span>
            <strong>{{ upfrontPayment.accountNumber }}</strong>
          </div>

          <small>{{ upfrontPayment.note }}</small>
        </div>

        <div v-else class="payment-summary-card no-payment">
          <strong>No upfront payment required</strong>
          <p>This service can be paid after admin assigns a provider and the job is completed.</p>
        </div>
      </section>

      <div class="form-actions sticky-form-actions">
        <button class="secondary" type="button" @click="$emit('back')">Cancel</button>
        <button class="primary" type="submit">Submit</button>
      </div>
    </form>
  </section>
</template>
