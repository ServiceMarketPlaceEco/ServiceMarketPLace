<script setup>
// public reviews page + the "Write a review" form
//
// reviews are tied to a finished booking now. before this the form let
// anyone (even guests) pick any service and type any name, but the backend
// only accepts a review from a signed in customer for one of their own
// completed bookings, so every submit failed (H6 in the qa report). it also
// means every review on the page comes from someone who really used the
// service, which is the whole point of the fake review checks on the admin side.
import { computed, reactive, ref } from 'vue'

const props = defineProps({
  reviews: { type: Array, default: () => [] },
  // finished bookings this customer hasnt reviewed yet (worked out in App.vue)
  reviewableBookings: { type: Array, default: () => [] },
  signedInUser: { type: Object, default: null },
})

const emit = defineEmits(['submit-review', 'sign-in'])
const showReviewForm = ref(false)

const form = reactive({
  bookingId: '',
  rating: 5,
  comment: '',
})

const isCustomer = computed(() => props.signedInUser?.role === 'customer')

const averageRating = computed(() => {
  if (!props.reviews.length) return '0.0'
  const total = props.reviews.reduce((sum, review) => sum + Number(review.rating), 0)
  return (total / props.reviews.length).toFixed(1)
})

// what goes in the booking dropdown, eg "Home Cleaning · rajshahi cleaners · 2026-11-02"
function bookingLabel(booking) {
  return [booking.serviceTitle, booking.providerName, booking.preferredDate]
    .filter(Boolean)
    .join(' · ')
}

function openForm() {
  // pick the booking straight away when theres only one to choose from
  form.bookingId = props.reviewableBookings.length === 1 ? props.reviewableBookings[0].id : ''
  showReviewForm.value = true
}

function goToSignIn() {
  showReviewForm.value = false
  emit('sign-in')
}

function submitReview() {
  if (!form.bookingId || !form.comment.trim()) return

  emit('submit-review', {
    bookingId: form.bookingId,
    rating: Number(form.rating),
    comment: form.comment.trim(),
  })

  form.bookingId = ''
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
        <p>Every review comes from a customer after a completed booking.</p>
      </div>
      <button class="primary" type="button" @click="openForm">
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
        <strong>Verified</strong>
        <small>From completed bookings</small>
      </article>
    </div>

    <div class="review-list">
      <article v-for="review in reviews" :key="review.id" class="clean-card review-card">
        <div class="review-card-top">
          <div class="reviewer-avatar" aria-hidden="true">{{ review.name?.charAt(0).toUpperCase() }}</div>
          <div>
            <strong>{{ review.name }}</strong>
            <small>{{ review.serviceTitle }}<template v-if="review.providerName"> · {{ review.providerName }}</template></small>
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
      <div v-if="showReviewForm" class="modal-backdrop" role="presentation" @click.self="showReviewForm = false"
        @keydown.esc="showReviewForm = false">

        <!-- guests: reviews need an account, so send them to sign in -->
        <div v-if="!signedInUser" class="modal-card review-form review-notice" role="dialog" aria-modal="true"
          aria-labelledby="review-form-title">
          <button class="icon-close" type="button" aria-label="Close" @click="showReviewForm = false">×</button>
          <p class="eyebrow">Share your experience</p>
          <h2 id="review-form-title">Sign in to write a review</h2>
          <p>Reviews come from customers who have finished a booking, so please sign in first.</p>
          <div class="form-actions">
            <button class="secondary" type="button" @click="showReviewForm = false">Cancel</button>
            <button class="primary" type="button" @click="goToSignIn">Sign in</button>
          </div>
        </div>

        <!-- providers and admins cant review (the backend only lets customers) -->
        <div v-else-if="!isCustomer" class="modal-card review-form review-notice" role="dialog" aria-modal="true"
          aria-labelledby="review-form-title">
          <button class="icon-close" type="button" aria-label="Close" @click="showReviewForm = false">×</button>
          <p class="eyebrow">Share your experience</p>
          <h2 id="review-form-title">Only customers can write reviews</h2>
          <p>Reviews are left by customers after a completed booking.</p>
          <div class="form-actions">
            <button class="primary" type="button" @click="showReviewForm = false">OK</button>
          </div>
        </div>

        <!-- customer, but nothing finished to review yet -->
        <div v-else-if="!reviewableBookings.length" class="modal-card review-form review-notice" role="dialog"
          aria-modal="true" aria-labelledby="review-form-title">
          <button class="icon-close" type="button" aria-label="Close" @click="showReviewForm = false">×</button>
          <p class="eyebrow">Share your experience</p>
          <h2 id="review-form-title">No finished bookings to review</h2>
          <p>You can write a review once one of your bookings is completed. Bookings you have already reviewed
            are not shown.</p>
          <div class="form-actions">
            <button class="primary" type="button" @click="showReviewForm = false">OK</button>
          </div>
        </div>

        <!-- the actual form -->
        <form v-else class="modal-card review-form" role="dialog" aria-modal="true" aria-labelledby="review-form-title"
          @submit.prevent="submitReview">
          <button class="icon-close" type="button" aria-label="Close review form"
            @click="showReviewForm = false">×</button>
          <p class="eyebrow">Share your experience</p>
          <h2 id="review-form-title">Write a review</h2>

          <div class="reviewer-identity" role="status">
            <span>Reviewing as</span>
            <strong>{{ signedInUser.name }}</strong>
            <small>{{ signedInUser.role }}</small>
          </div>

          <label>
            Booking
            <select v-model="form.bookingId" required>
              <option disabled value="">Choose a finished booking</option>
              <option v-for="booking in reviewableBookings" :key="booking.id" :value="booking.id">
                {{ bookingLabel(booking) }}
              </option>
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

.review-hero>div {
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

.review-notice p:not(.eyebrow) {
  color: var(--muted);
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

.review-card-top>div:nth-child(2) {
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
