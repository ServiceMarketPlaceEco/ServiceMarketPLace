<script setup>
// Privacy Policy and Terms of Use.
//
// These are a starting draft written from what ServiceHub actually stores and
// shares. Words in [square brackets] have to be filled in by the business,
// and a lawyer should check both pages before launch. The yellow note at the
// top stays until DRAFT below is set to false.
import { computed } from 'vue'

const DRAFT = true

const props = defineProps({
  // 'privacy' or 'terms'
  page: { type: String, default: 'privacy' }
})

const isPrivacy = computed(() => props.page === 'privacy')
</script>

<template>
  <section class="page-section legal-page">
    <article class="clean-card legal-card">
      <p class="eyebrow">ServiceHub</p>

      <p v-if="DRAFT" class="legal-draft" role="note">
        Draft for review. The business still has to fill in the parts in [square brackets] and have this page checked
        before launch.
      </p>

      <template v-if="isPrivacy">
        <h1>Privacy Policy</h1>
        <p class="muted">Last updated: [date]</p>

        <p>
          ServiceHub is run by [business name], [address], Rajshahi, Bangladesh ("we"). This policy explains what we
          collect when you use ServiceHub, why, who sees it and what you can ask us to do with it. If you have any
          questions, contact us at [contact email].
        </p>

        <h2>What we collect</h2>
        <ul>
          <li><strong>Your account:</strong> your name, username, phone number, password (stored scrambled, we can
            never read it), your area, and your email if you give one. Providers also give their service type,
            experience and the areas they cover.</li>
          <li><strong>Bookings:</strong> the service you request, the address, date, time, budget and the details you
            write.</li>
          <li><strong>Provider location:</strong> while a provider has a job in progress and chooses
            <strong>Share location</strong>, we store their position so the customer can follow them on the map. We
            do not track customers' location.</li>
          <li><strong>Messages and reviews:</strong> chat messages between customers, providers and our admin team,
            and the reviews customers write.</li>
          <li><strong>Sign-in information:</strong> your browser keeps a sign-in token so you stay signed in. We do not
            use advertising or tracking cookies.</li>
        </ul>

        <h2>Why we use it</h2>
        <ul>
          <li>To create your account and confirm your phone number with a text message code.</li>
          <li>To pass your request to a suitable provider and let you both follow the job.</li>
          <li>To send emails about your account and bookings, such as password resets and booking updates.</li>
          <li>To keep the marketplace safe: our admins check reviews before they are shown, and look for fake reviews
            and fake accounts.</li>
        </ul>

        <h2>Who can see it</h2>
        <ul>
          <li><strong>Your provider</strong> sees your name, phone number, address and the request details, only for
            jobs they have been given.</li>
          <li><strong>Our admin team</strong> can see accounts, bookings, chats and reviews to run the service and
            handle problems.</li>
          <li><strong>The public</strong> sees your name, rating and comment on a review once our team approves it. Your phone number and email are never shown.</li>
          <li><strong>Services that help us run ServiceHub:</strong> Twilio sends the phone codes, [email provider]
            sends our emails, and our hosting company stores the data. The AI help chatbot and voice search send what
            you type or say to OpenAI to suggest a service. When our admins use the AI review check, the review's rating
            and text are sent to Anthropic, without names or contact details. Maps are loaded from OpenStreetMap. If you
            use Google sign-in, Google confirms your email to us.</li>
        </ul>
        <p>We do not sell your information.</p>

        <h2>How long we keep it</h2>
        <p>
          We keep your account while it is open. Booking records are kept for [time period] for our records and to
          handle disputes. A provider's live location is only used while a job is in progress. Phone codes expire
          after 10 minutes.
        </p>

        <h2>Your choices</h2>
        <p>
          To get a copy of your information, correct it, or close your account and have it removed, email [contact
          email]. Providers can also update their own profile in Settings. We may keep some records where we need them for a
          dispute or the law.
        </p>

        <h2>Keeping it safe</h2>
        <p>
          The site uses HTTPS, passwords are stored scrambled, sign-in attempts are limited, and only our admin team
          can see other people's details. No system is perfectly secure, so please use a strong password that you do
          not use anywhere else.
        </p>

        <h2>Changes</h2>
        <p>If we change this policy we will update the date at the top and tell you about important changes.</p>
      </template>

      <template v-else>
        <h1>Terms of Use</h1>
        <p class="muted">Last updated: [date]</p>

        <p>
          These terms are an agreement between you and [business name] ("we"), who run ServiceHub. By creating an
          account or using ServiceHub you agree to them. Contact: [contact email].
        </p>

        <h2>What ServiceHub does</h2>
        <p>
          ServiceHub connects customers in Rajshahi with independent local service providers. Providers are not our
          employees. They are responsible for the work they do, the tools they use and following the law. We check
          provider applications before they can work, but we do not guarantee every job.
        </p>

        <h2>Your account</h2>
        <ul>
          <li>Give true details, including a phone number you can receive texts on.</li>
          <li>Keep your password private. You are responsible for what happens in your account.</li>
          <li>Provider accounts are only active once our admin team has approved them.</li>
        </ul>

        <h2>Bookings</h2>
        <ul>
          <li>Our admin team assigns a provider to each request. The provider can still decline a job.</li>
          <li>Agree the price and the time with your provider before the work starts. [Payment terms, for example: pay
            the provider directly when the job is done.]</li>
          <li>Cancel as early as you can if your plans change. [Any cancellation rules or fees.]</li>
        </ul>

        <h2>Messages and reviews</h2>
        <ul>
          <li>Be respectful in chats. Do not send abuse, threats, spam or anything illegal.</li>
          <li>Reviews must be honest and about your own booking. Our admin team checks every review before it is shown
            and can reject reviews that are fake, abusive or off-topic.</li>
          <li>Do not offer or accept payment for reviews.</li>
        </ul>

        <h2>Rules for providers</h2>
        <ul>
          <li>Do the work you accepted, safely and to a reasonable standard, and arrive when agreed.</li>
          <li>Only share your location while you are on the way to or at a job.</li>
          <li>Use customers' details only for the job you were given.</li>
        </ul>

        <h2>When we can suspend an account</h2>
        <p>
          We can suspend or close an account that breaks these terms, gives false details, writes fake reviews or puts
          other people at risk. If you think we made a mistake, contact [contact email].
        </p>

        <h2>Our responsibility</h2>
        <p>
          We work to keep ServiceHub running and safe, but we provide it as it is and cannot promise it will always be
          available. [Liability wording to be checked by a lawyer.] Nothing in these terms takes away rights you have
          under the law of Bangladesh.
        </p>

        <h2>Changes and law</h2>
        <p>
          We may update these terms and will change the date at the top when we do. These terms are governed by the
          law of Bangladesh.
        </p>
      </template>

      <p class="legal-links">
        <a href="#privacy">Privacy Policy</a> · <a href="#terms">Terms of Use</a>
      </p>
    </article>
  </section>
</template>

<style scoped>
.legal-card {
  max-width: 820px;
  margin: 0 auto;
  padding: clamp(24px, 4vw, 48px);
  line-height: 1.7;
}

.legal-card h1 {
  margin: 4px 0 6px;
}

.legal-card h2 {
  margin: 28px 0 8px;
  font-size: 1.15rem;
}

.legal-card ul {
  padding-left: 20px;
}

.legal-card li {
  margin-bottom: 6px;
}

.legal-draft {
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  background: var(--warning-bg);
  color: var(--warning);
  font-weight: 600;
}

.legal-links {
  margin-top: 32px;
  color: var(--muted);
}

.legal-links a {
  color: var(--brand);
}
</style>
