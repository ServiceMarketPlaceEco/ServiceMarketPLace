<script setup>
import { computed, reactive, ref } from 'vue'

const props = defineProps({
  reviews: { type: Array, default: () => [] },
  services: { type: Array, default: () => [] },
  signedInUser: { type: Object, default: null },
})

const emit = defineEmits(['submit-review'])
const showReviewForm = ref(false)

const form = reactive({
  // Signed-in details are convenient defaults, but sign-in is not required.
  username: props.signedInUser?.name || '',
  reviewerType: ['customer', 'provider'].includes(props.signedInUser?.role)
    ? props.signedInUser.role
    : 'customer',
  serviceId: '',
  rating: 5,
  comment: '',
})

// Logged-in accounts use their stored identity and role. Guests can still
// submit a review by supplying both fields themselves.
const hasDetectedRole = computed(() =>
  ['customer', 'provider'].includes(props.signedInUser?.role)
)
const reviewerName = computed(() =>
  hasDetectedRole.value ? props.signedInUser.name : form.username.trim()
)
const reviewerType = computed(() =>
  hasDetectedRole.value ? props.signedInUser.role : form.reviewerType
)
const averageRating = computed(() => {
  if (!props.reviews.length) return '0.0'
  const total = props.reviews.reduce((sum, review) => sum + Number(review.rating), 0)
  return (total / props.reviews.length).toFixed(1)
})

function submitReview() {
  if (
    !reviewerName.value ||
    !reviewerType.value ||
    !form.serviceId ||
    !form.comment.trim()
  ) return

  const service = props.services.find((item) => item.id === form.serviceId)

  emit('submit-review', {
    name: reviewerName.value,
    role: reviewerType.value,
    serviceId: form.serviceId,
    serviceTitle: service?.title || 'ServiceHub service',
    rating: Number(form.rating),
    comment: form.comment.trim(),
  })

  form.serviceId = ''
  form.rating = 5
  form.comment = ''
  showReviewForm.value = false
}
</script>

<template>
  <section class="page-section reviews-page">
    <header class="review-hero clean-card">
      <div>
        <p class="eyebrow">ServiceHub reviews</p>
        <h2>Real experiences from the Rajshahi community</h2>
        <p>Browse feedback from customers and providers, or share your own service experience.</p>
      </div>
      <button class="primary" type="button" @click="showReviewForm = true">
        Write a review
      </button>
    </header>

    <div class="review-summary" aria-label="Review statistics">
      <article class="clean-card">
        <strong>{{ averageRating }}</strong>
        <span aria-hidden="true">★★★★★</span>
        <small>Average rating</small>
      </article>
      <article class="clean-card">
        <strong>{{ reviews.length }}</strong>
        <small>Community reviews</small>
      </article>
      <article class="clean-card">
        <strong>Open</strong>
        <small>Customer and provider feedback</small>
      </article>
    </div>

    <div class="review-list">
      <article v-for="review in reviews" :key="review.id" class="clean-card review-card">
        <div class="review-card-top">
          <div class="reviewer-avatar" aria-hidden="true">{{ review.name?.charAt(0).toUpperCase() }}</div>
          <div>
            <strong>{{ review.name }}</strong>
            <small>{{ review.serviceTitle }} · {{ review.role }}</small>
          </div>
          <span :aria-label="`${review.rating} out of 5 stars`">{{ review.rating }}/5 ★</span>
        </div>
        <p>“{{ review.comment }}”</p>
      </article>

      <div v-if="!reviews.length" class="empty-state">
        No submitted reviews yet. Be the first to write one.
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="showReviewForm"
        class="modal-backdrop"
        role="presentation"
        @click.self="showReviewForm = false"
        @keydown.esc="showReviewForm = false"
      >
        <form
          class="modal-card review-form"
          role="dialog"
          aria-modal="true"
          aria-labelledby="review-form-title"
          @submit.prevent="submitReview"
        >
          <button class="icon-close" type="button" aria-label="Close review form" @click="showReviewForm = false">×</button>
          <p class="eyebrow">Share your experience</p>
          <h2 id="review-form-title">Write a review</h2>

          <div v-if="hasDetectedRole" class="reviewer-identity" role="status">
            <span>Reviewing as</span>
            <strong>{{ signedInUser.name }}</strong>
            <small>{{ signedInUser.role }}</small>
          </div>

          <label v-else>
            Username
            <input v-model="form.username" required autocomplete="username" placeholder="Enter your username" />
          </label>

          <label v-if="!hasDetectedRole">
            User type
            <select v-model="form.reviewerType" required>
              <option value="customer">Customer</option>
              <option value="provider">Provider</option>
            </select>
          </label>

          <label>
            Service
            <select v-model="form.serviceId" required>
              <option disabled value="">Choose a service</option>
              <option v-for="service in services" :key="service.id" :value="service.id">{{ service.title }}</option>
            </select>
          </label>

          <label>
            Rating
            <select v-model.number="form.rating" required>
              <option :value="5">5 — Excellent</option>
              <option :value="4">4 — Very good</option>
              <option :value="3">3 — Good</option>
              <option :value="2">2 — Fair</option>
              <option :value="1">1 — Poor</option>
            </select>
          </label>

          <label>
            Review
            <textarea v-model="form.comment" rows="5" required placeholder="Describe your experience..."></textarea>
          </label>

          <div class="form-actions">
            <button class="secondary" type="button" @click="showReviewForm = false">Cancel</button>
            <button class="primary" type="submit">Submit review</button>
          </div>
        </form>
      </div>
    </Teleport>
  </section>
</template>

<style scoped>
.reviews-page {
  display: grid;
  gap: 1.75rem;
}

.review-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
  padding: clamp(1.5rem, 4vw, 3rem);
}

.review-hero > div {
  max-width: 47rem;
}

.review-hero h2 {
  font-size: clamp(2rem, 5vw, 3.6rem);
}

.review-hero p:last-child {
  margin-top: 1rem;
  color: var(--muted);
}

.review-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
}

.review-summary article {
  display: grid;
  gap: 0.25rem;
  padding: 1.25rem;
}

.review-summary strong {
  color: var(--heading);
  font-size: 1.65rem;
}

.review-summary span {
  color: #f59e0b;
  letter-spacing: 0.08em;
}

.review-summary small {
  color: var(--muted);
}

.reviewer-identity {
  display: grid;
  gap: 0.2rem;
  padding: 1rem;
  border: 1px solid var(--line);
  border-radius: 1rem;
  background: var(--brand-soft);
}

.reviewer-identity span,
.reviewer-identity small {
  color: var(--muted);
}

.reviewer-identity small {
  text-transform: capitalize;
}

.review-form label {
  display: grid;
  gap: 0.45rem;
  font-weight: 800;
}

.review-form input,
.review-form select,
.review-form textarea {
  width: 100%;
  box-sizing: border-box;
}

.review-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.review-card {
  display: grid;
  gap: 1.25rem;
  padding: 1.5rem;
}

.review-card-top {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.8rem;
}

.review-card-top > div:nth-child(2) {
  display: flex;
  flex-direction: column;
}

.review-card-top span {
  color: #b66b00;
  font-weight: 900;
}

.review-card small,
.review-card p {
  color: var(--muted);
}

.reviewer-avatar {
  display: grid;
  place-items: center;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 50%;
  background: var(--brand-soft);
  color: var(--brand-2);
  font-weight: 900;
}

@media (max-width: 760px) {
  .review-hero {
    align-items: stretch;
    flex-direction: column;
  }

  .review-hero .primary {
    width: 100%;
  }

  .review-summary,
  .review-list {
    grid-template-columns: 1fr;
  }
}
</style>
