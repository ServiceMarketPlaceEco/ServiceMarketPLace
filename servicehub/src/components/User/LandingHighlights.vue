<script setup>
import { computed } from 'vue'

const props = defineProps({
  reviews: { type: Array, default: () => [] },
})

defineEmits(['become-provider'])

const sampleReviews = [
  {
    id: 'sample-1',
    name: 'Sabrina Rahman',
    serviceTitle: 'Home Cleaning',
    rating: 5,
    comment: 'The provider arrived on time and completed everything carefully.',
  },
  {
    id: 'sample-2',
    name: 'Rafiq Ahmed',
    serviceTitle: 'AC Repair',
    rating: 5,
    comment: 'Clear communication, professional work and helpful status updates.',
  },
  {
    id: 'sample-3',
    name: 'Nusrat Jahan',
    serviceTitle: 'Local Delivery',
    rating: 4,
    comment: 'Easy to request and I could follow the service progress.',
  },
]

const displayedReviews = computed(() =>
  (props.reviews.length ? props.reviews : sampleReviews).slice(0, 3)
)

const averageRating = computed(() => {
  if (!displayedReviews.value.length) return '0.0'
  const total = displayedReviews.value.reduce((sum, review) => sum + Number(review.rating), 0)
  return (total / displayedReviews.value.length).toFixed(1)
})
</script>

<template>
  <!-- Public customer-review preview shown below the landing hero. -->
  <section class="page-section landing-review-section">
    <div class="section-heading landing-heading-row">
      <div>
        <p class="eyebrow">Customer reviews</p>
        <h2>Trusted by customers across Rajshahi</h2>
        <p>See how local customers rate ServiceHub providers and completed services.</p>
      </div>
      <div class="landing-rating-summary" aria-label="Review summary">
        <strong>{{ averageRating }}/5</strong>
        <span>Average local rating</span>
      </div>
    </div>

    <div class="landing-review-grid">
      <article
        v-for="review in displayedReviews"
        :key="review.id"
        class="clean-card landing-review-card"
      >
        <div class="review-stars" :aria-label="`${review.rating} out of 5 stars`">
          {{ '★'.repeat(Number(review.rating)) }}{{ '☆'.repeat(5 - Number(review.rating)) }}
        </div>
        <p>“{{ review.comment || review.text }}”</p>
        <strong>{{ review.name }}</strong>
        <small>{{ review.serviceTitle || review.service }}</small>
      </article>
    </div>
  </section>

  <!-- Public provider invitation shown after customer reviews. -->
  <section class="page-section provider-invitation">
    <div class="provider-invitation-card clean-card">
      <div class="provider-invitation-copy">
        <span class="provider-badge">For Rajshahi service professionals</span>
        <p class="eyebrow">Deliver services with ServiceHub</p>
        <h2>Turn your skills into a trusted local business</h2>
        <p>
          Join a marketplace designed to connect trusted Rajshahi providers
          with customers who need reliable local help.
        </p>
        <button class="primary" type="button" @click="$emit('become-provider')">
          Become a provider <span aria-hidden="true">→</span>
        </button>
        <small>No joining fee · Admin-verified profiles · Clear job tracking</small>
      </div>

      <div class="provider-benefit-grid">
        <article>
          <span class="benefit-icon" aria-hidden="true">↗</span>
          <div>
            <small>01 · FIND WORK</small>
            <strong>Receive relevant local requests</strong>
            <p>Connect with nearby customers searching for your type of service.</p>
          </div>
        </article>
        <article>
          <span class="benefit-icon" aria-hidden="true">✓</span>
          <div>
            <small>02 · STAY ORGANISED</small>
            <strong>Manage every job clearly</strong>
            <p>Accept assigned work and keep customers informed with live statuses.</p>
          </div>
        </article>
        <article>
          <span class="benefit-icon" aria-hidden="true">★</span>
          <div>
            <small>03 · GROW TRUST</small>
            <strong>Build a strong reputation</strong>
            <p>Collect verified ratings and give new customers confidence to book.</p>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped>
.landing-heading-row,
.provider-invitation-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
}

.landing-review-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1.25rem;
}

.landing-review-card {
  display: grid;
  gap: 0.8rem;
  padding: 1.5rem;
}

.landing-review-card p {
  margin: 0;
  color: var(--muted);
  line-height: 1.7;
}

.landing-review-card small {
  color: var(--muted);
}

.landing-rating-summary {
  flex: 0 0 auto;
  display: grid;
  min-width: 11rem;
  padding: 1rem 1.25rem;
  border: 1px solid var(--line);
  border-radius: 1rem;
  background: var(--surface);
}

.landing-rating-summary strong {
  color: var(--heading);
  font-size: 1.35rem;
}

.landing-rating-summary span {
  color: var(--muted);
  font-size: 0.85rem;
}

.review-stars {
  color: #f59e0b;
  font-size: 1.2rem;
  letter-spacing: 0.1em;
}

.provider-invitation-card {
  position: relative;
  overflow: hidden;
  padding: clamp(1.75rem, 5vw, 4rem);
  border-color: color-mix(in srgb, var(--brand) 28%, var(--line));
  background:
    radial-gradient(circle at 5% 5%, color-mix(in srgb, var(--brand) 17%, transparent), transparent 22rem),
    var(--surface);
}

.provider-invitation-copy {
  display: grid;
  justify-items: start;
  gap: 1rem;
  max-width: 36rem;
}

.provider-invitation-copy .eyebrow {
  margin: 0;
}

.provider-invitation-copy h2 {
  max-width: 12ch;
  font-size: clamp(2.25rem, 4.5vw, 4rem);
}

.provider-invitation-copy > p:not(.eyebrow) {
  max-width: 34rem;
  color: var(--muted);
  font-size: 1.05rem;
}

.provider-invitation-copy .primary {
  padding-inline: 1.4rem;
}

.provider-invitation-copy > small {
  color: var(--muted);
  font-weight: 700;
}

.provider-badge {
  padding: 0.45rem 0.75rem;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface);
  color: var(--brand-2);
  font-size: 0.78rem;
  font-weight: 900;
}

.provider-benefit-grid {
  display: grid;
  gap: 0.85rem;
  width: min(100%, 36rem);
}

.provider-benefit-grid article {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1.25rem;
  border: 1px solid var(--line);
  border-radius: 1.25rem;
  background: color-mix(in srgb, var(--surface) 94%, var(--brand-soft));
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}

.provider-benefit-grid article:hover {
  transform: translateY(-2px);
  border-color: var(--line-strong);
  box-shadow: var(--shadow-sm);
}

.benefit-icon {
  flex: 0 0 2.75rem;
  display: grid;
  place-items: center;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 0.9rem;
  background: var(--brand-soft);
  color: var(--brand-2);
  font-size: 1.15rem;
  font-weight: 900;
}

.provider-benefit-grid article > div {
  display: grid;
  gap: 0.3rem;
}

.provider-benefit-grid small {
  color: var(--brand-2);
  letter-spacing: 0.08em;
  font-size: 0.72rem;
  font-weight: 900;
}

.provider-benefit-grid strong {
  color: var(--heading);
  font-size: 1.05rem;
}

.provider-benefit-grid p {
  margin: 0;
  color: var(--muted);
}

@media (max-width: 800px) {
  .landing-heading-row,
  .provider-invitation-card {
    align-items: stretch;
    flex-direction: column;
  }

  .landing-review-grid {
    grid-template-columns: 1fr;
  }

  .provider-invitation-copy h2 {
    max-width: none;
  }
}

@media (max-width: 520px) {
  .provider-invitation-copy .primary {
    width: 100%;
  }

  .provider-invitation-copy > small {
    text-align: center;
  }
}
</style>
