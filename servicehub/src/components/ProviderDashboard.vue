<script setup>
// provider dashboard component: professional operations workspace for service providers.
import { computed, ref } from 'vue'

const props = defineProps({
  requests: { type: Array, default: () => [] },
  providerName: { type: String, default: 'Provider' }
})

const emit = defineEmits(['status-change', 'block-request', 'sign-out', 'go-home'])

// activeView changes the center content without needing vue-router.
const activeView = ref('dashboard')
const searchTerm = ref('')
const declineTarget = ref(null)
const declineReason = ref('')
const replyTarget = ref(null)
const replyText = ref('')
const blockTargetName = ref('')
const blockReason = ref('')

// providerRequests are the jobs visible to the current provider dashboard.
const providerRequests = computed(() => props.requests)

// pendingRequests returns only open jobs that need provider response.
const pendingRequests = computed(() => providerRequests.value.filter(item => item.status === 'Pending'))

// activeJobs returns jobs accepted or already in progress.
const activeJobs = computed(() => providerRequests.value.filter(item => ['Accepted', 'In Progress'].includes(item.status)))

// monthlyEstimate approximates visible provider earnings for prototype display.
const monthlyEstimate = computed(() => activeJobs.value.reduce((sum, item) => sum + Number(item.total || 0), 0))

// filteredRequests supports the search box on the request management view.
const filteredRequests = computed(() => {
  const q = searchTerm.value.toLowerCase().trim()
  if (!q) return providerRequests.value
  return providerRequests.value.filter(item => `${item.serviceTitle} ${item.customerName} ${item.area} ${item.status}`.toLowerCase().includes(q))
})

// acceptRequest updates parent booking status using a single emitted action.
function acceptRequest(request) {
  emit('status-change', { id: request.id, status: 'Accepted' })
}

// startJob marks an accepted request as in progress.
function startJob(request) {
  emit('status-change', { id: request.id, status: 'In Progress' })
}

// completeJob marks the provider job as completed.
function completeJob(request) {
  emit('status-change', { id: request.id, status: 'Completed' })
}

// openDeclineModal stores which request is being declined and shows the modal.
function openDeclineModal(request) {
  declineTarget.value = request
  declineReason.value = ''
}

// confirmDecline closes the modal after validating the provider entered a reason.
function confirmDecline() {
  if (!declineReason.value.trim()) return
  emit('status-change', { id: declineTarget.value.id, status: 'Declined' })
  declineTarget.value = null
}

// saveReply stores a temporary local reply for the prototype reviews screen.
function saveReply() {
  if (!replyText.value.trim()) return
  replyTarget.value.reply = replyText.value
  replyTarget.value = null
  replyText.value = ''
}

// Sends a provider-to-customer block request to admin review.
function requestCustomerBlock() {
  if (!blockTargetName.value.trim() || !blockReason.value.trim()) return
  emit('block-request', { targetName: blockTargetName.value, targetRole: 'customer', reason: blockReason.value })
  blockTargetName.value = ''
  blockReason.value = ''
}

const reviews = ref([
  { name: 'Rafiq Ahmed', service: 'AC Repair', rating: 5, text: 'Excellent service. The provider arrived on time and explained the repair clearly.', replied: true, reply: 'Thank you for your kind feedback.' },
  { name: 'Sabrina Khan', service: 'AC Servicing', rating: 5, text: 'Very thorough servicing and professional communication.', replied: false, reply: '' },
  { name: 'Mohammad Ali', service: 'AC Installation', rating: 4, text: 'Good installation work. It took slightly longer than expected, but the quality was excellent.', replied: true, reply: 'Thank you. We always try to maintain quality installation.' }
])
</script>

<template>
  <section class="ops-layout">
    <aside class="ops-sidebar">
      <div class="ops-user">
        <div class="avatar">AK</div>
        <div><strong>{{ providerName }}</strong><small>Service provider</small></div>
      </div>
      <nav class="ops-menu">
        <button :class="{ active: activeView === 'dashboard' }" @click="activeView = 'dashboard'">Dashboard</button>
        <button :class="{ active: activeView === 'services' }" @click="activeView = 'services'">My services</button>
        <button :class="{ active: activeView === 'requests' }" @click="activeView = 'requests'">Requests</button>
        <button :class="{ active: activeView === 'messages' }" @click="activeView = 'messages'">Messages</button>
        <button :class="{ active: activeView === 'reviews' }" @click="activeView = 'reviews'">Reviews</button>
        <button :class="{ active: activeView === 'settings' }" @click="activeView = 'settings'">Settings</button>
      </nav>
      <div class="ops-bottom"><button @click="$emit('go-home')">Back to home</button><button
          @click="$emit('sign-out')">Sign out</button></div>
    </aside>

    <main class="ops-main">
      <header class="ops-topbar">
        <div>
          <h1>{{ activeView === 'dashboard' ? 'Provider dashboard' : activeView }}</h1>
          <p>Manage your services, requests and customer communication.</p>
        </div><input v-model="searchTerm" placeholder="Search..." />
      </header>

      <template v-if="activeView === 'dashboard'">
        <div class="stat-grid four">
          <article class="stat-card dark"><span>Total earnings</span><strong>৳{{ monthlyEstimate.toLocaleString()
          }}</strong><small>prototype estimate</small></article>
          <article class="stat-card dark"><span>This month</span><strong>৳{{ monthlyEstimate.toLocaleString()
          }}</strong><small>visible accepted jobs</small></article>
          <article class="stat-card dark"><span>Total jobs</span><strong>{{ providerRequests.length
          }}</strong><small>all assigned records</small></article>
          <article class="stat-card dark"><span>Average rating</span><strong>4.8</strong><small>{{ reviews.length }}
              reviews</small></article>
        </div>
        <div class="ops-grid two">
          <section class="ops-panel">
            <div class="panel-heading">
              <h2>Pending requests</h2><button @click="activeView = 'requests'">View all</button>
            </div>
            <article v-for="request in pendingRequests" :key="request.id" class="request-row">
              <div><strong>{{ request.serviceTitle }}</strong><small>{{ request.customerName }} · {{ request.date }} ·
                  ৳{{ request.total }}</small></div>
              <div><button class="secondary small" @click="openDeclineModal(request)">Decline</button><button
                  class="primary small" @click="acceptRequest(request)">Accept</button></div>
            </article>
          </section>
          <section class="ops-panel">
            <div class="panel-heading">
              <h2>Recent reviews</h2><button @click="activeView = 'reviews'">View all</button>
            </div>
            <article v-for="review in reviews.slice(0, 2)" :key="review.name" class="review-row"><strong>{{ review.name
            }}</strong><small>{{ review.service }} · {{ review.rating }}/5</small>
              <p>{{ review.text }}</p>
            </article>
          </section>
        </div>
      </template>

      <template v-if="activeView === 'services'">
        <div class="stat-grid three">
          <article class="stat-card dark"><span>Total services</span><strong>4</strong></article>
          <article class="stat-card dark"><span>Active services</span><strong>3</strong></article>
          <article class="stat-card dark"><span>Inactive services</span><strong>1</strong></article>
        </div>
        <section class="ops-panel">
          <div class="panel-heading">
            <h2>Your services</h2><button class="primary small">Add new service</button>
          </div>
          <article
            v-for="service in ['AC Repair & Troubleshooting', 'AC Installation', 'AC Servicing & Maintenance', 'Emergency AC Repair']"
            :key="service" class="service-line">
            <div><strong>{{ service }}</strong>
              <p>Professional local service with clear pricing and availability.</p><small>৳800+ · 1-2 hours · added jun
                20, 2023</small>
            </div><label class="switch"><input type="checkbox" checked><span></span></label>
          </article>
        </section>
      </template>

      <template v-if="activeView === 'requests'">
        <div class="stat-grid four">
          <article class="stat-card dark"><span>Pending</span><strong>{{ pendingRequests.length }}</strong></article>
          <article class="stat-card dark"><span>Active jobs</span><strong>{{ activeJobs.length }}</strong></article>
          <article class="stat-card dark"><span>Completed</span><strong>{{providerRequests.filter(r => r.status ===
            'Completed').length}}</strong></article>
          <article class="stat-card dark"><span>Total requests</span><strong>{{ providerRequests.length }}</strong>
          </article>
        </div>
        <section class="ops-panel">
          <div class="tab-row"><button
              class="active">All</button><button>Pending</button><button>Active</button><button>Completed</button></div>
          <article v-for="request in filteredRequests" :key="request.id" class="large-request-row">
            <div>
              <h3>{{ request.serviceTitle }}</h3>
              <p>{{ request.customerName }} · {{ request.area }} · {{ request.date }} at {{ request.time }}</p><small>{{
                request.notes }}</small>
            </div><strong>৳{{ request.total }}</strong><span class="status-pill"
              :class="request.status.toLowerCase().replace(' ', '-')">{{ request.status }}</span>
            <div class="row-actions"><button v-if="request.status === 'Pending'" class="secondary small"
                @click="openDeclineModal(request)">Decline</button><button v-if="request.status === 'Pending'"
                class="primary small" @click="acceptRequest(request)">Accept</button><button
                v-if="request.status === 'Accepted'" class="primary small" @click="startJob(request)">Start
                job</button><button v-if="request.status === 'In Progress'" class="success small"
                @click="completeJob(request)">Complete</button></div>
          </article>
        </section>
      </template>

      <template v-if="activeView === 'messages'">
        <section class="ops-panel messages-panel">
          <aside><input placeholder="Search conversations..." /><button
              v-for="person in ['Rafiq Ahmed', 'Nusrat Jahan', 'Mohammad Ali']" :key="person">{{ person
              }}<small>Customer
                conversation</small></button></aside>
          <div class="chat-empty">
            <h2>Your messages</h2>
            <p>Select a conversation to start messaging.</p>
          </div>
        </section>
      </template>

      <template v-if="activeView === 'reviews'">
        <div class="stat-grid four">
          <article class="stat-card dark"><span>Average rating</span><strong>4.6</strong></article>
          <article class="stat-card dark"><span>Total reviews</span><strong>{{ reviews.length }}</strong></article>
          <article class="stat-card dark"><span>Response rate</span><strong>67%</strong></article>
          <article class="stat-card dark"><span>Pending replies</span><strong>{{reviews.filter(r => !r.replied).length
          }}</strong></article>
        </div>
        <section class="ops-panel">
          <h2>Customer reviews</h2>
          <article v-for="review in reviews" :key="review.name" class="review-row expanded">
            <div><strong>{{ review.name }}</strong><small>{{ review.service }} · {{ review.rating }}/5</small>
              <p>{{ review.text }}</p>
              <p v-if="review.reply" class="reply-box">{{ review.reply }}</p>
            </div><button v-if="!review.reply" class="primary small" @click="replyTarget = review">Reply</button>
          </article>
        </section>
      </template>

      <template v-if="activeView === 'settings'">
        <section class="ops-panel">
          <h2>Safety request</h2>
          <p class="muted">Request to block a customer. Admin reviews it before any action is applied.</p>
          <div class="settings-grid">
            <label>Customer name<input v-model="blockTargetName" placeholder="Customer name from request" /></label>
            <label>Reason<input v-model="blockReason" placeholder="Reason for admin review" /></label>
          </div>
          <button class="secondary small" @click="requestCustomerBlock">Send block request</button>
        </section>
        <section class="ops-panel settings-panel">
          <h2>Profile information</h2>
          <div class="settings-grid"><label>Full name<input :value="providerName" /></label><label>Phone number<input
                value="+880 1711-111111" /></label><label>Email address<input
                value="abdul.karim@provider.com" /></label><label>Service area<input
                value="Rajshahi City" /></label><label class="full">Bio<textarea
                rows="4">Experienced service provider with verified local support history.</textarea></label></div>
          <button class="primary">Save changes</button>
        </section>
      </template>
    </main>

    <section v-if="declineTarget" class="modal-backdrop" @click.self="declineTarget = null">
      <div class="modal-card"><button class="icon-close" @click="declineTarget = null">close</button>
        <h2>Decline request</h2>
        <p>Provide a reason. This should be shared with the customer.</p><label>Reason<textarea v-model="declineReason"
            rows="4" placeholder="Schedule conflict, outside service area, unavailable items..."></textarea></label>
        <div class="form-actions"><button class="secondary" @click="declineTarget = null">Cancel</button><button
            class="danger" @click="confirmDecline">Decline request</button></div>
      </div>
    </section>
    <section v-if="replyTarget" class="modal-backdrop" @click.self="replyTarget = null">
      <div class="modal-card"><button class="icon-close" @click="replyTarget = null">close</button>
        <h2>Reply to review</h2><textarea v-model="replyText" rows="5"
          placeholder="Write a professional response..."></textarea>
        <div class="form-actions"><button class="secondary" @click="replyTarget = null">Cancel</button><button
            class="primary" @click="saveReply">Save reply</button></div>
      </div>
    </section>
  </section>
</template>
