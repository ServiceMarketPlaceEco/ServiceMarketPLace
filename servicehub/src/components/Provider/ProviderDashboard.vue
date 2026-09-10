<script setup>
import { computed, reactive, ref } from 'vue'

const props = defineProps({
  currentUser: { type: Object, default: null },
  requests: { type: Array, default: () => [] },
  chatApprovals: { type: Array, default: () => [] },
  messages: { type: Array, default: () => [] },
  theme: { type: String, default: 'light' }
})

const emit = defineEmits(['accept-request', 'decline-request', 'status-change', 'request-chat', 'send-message', 'block-request', 'sign-out', 'go-home', 'toggle-theme'])

const activeView = ref('dashboard')
const searchTerm = ref('')
const declineTarget = ref(null)
const declineReason = ref('')
const replyTarget = ref(null)
const replyText = ref('')
const messageByRequest = ref({})
const blockTargetName = ref('')
const blockReason = ref('')
const showServiceModal = ref(false)

const providerServices = ref([
  { id: 1, title: 'AC Repair & Troubleshooting', price: 800, duration: '1-2 hours', active: true },
  { id: 2, title: 'AC Installation', price: 1500, duration: '2-4 hours', active: true },
  { id: 3, title: 'AC Servicing & Maintenance', price: 700, duration: '1 hour', active: true },
  { id: 4, title: 'Emergency AC Repair', price: 1200, duration: 'same day', active: false }
])

const newService = reactive({ title: '', price: '', duration: '', active: true })
const reviews = ref([
  { name: 'Rafiq Ahmed', service: 'AC Repair', rating: 5, text: 'Excellent service. The provider arrived on time and explained the repair clearly.', reply: 'Thank you for your kind feedback.' },
  { name: 'Sabrina Khan', service: 'AC Servicing', rating: 5, text: 'Very thorough servicing and professional communication.', reply: '' },
  { name: 'Mohammad Ali', service: 'AC Installation', rating: 4, text: 'Good installation work. It took slightly longer than expected, but the quality was excellent.', reply: 'Thank you. We always try to maintain quality installation.' }
])

const displayName = computed(() => props.currentUser?.name || 'Rajshahi Provider')
const providerService = computed(() => props.currentUser?.serviceType || 'General service')
const avatarText = computed(() => displayName.value.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase())
const providerRequests = computed(() => props.requests.filter(request => request.providerId === props.currentUser?.id))
const pendingRequests = computed(() => providerRequests.value.filter(item => item.providerStatus === 'waiting-provider-acceptance'))
const activeJobs = computed(() => providerRequests.value.filter(item => ['accepted', 'in-progress'].includes(item.providerStatus)))
const completedJobs = computed(() => providerRequests.value.filter(item => item.status === 'completed' || item.providerStatus === 'completed'))
const monthlyEstimate = computed(() => activeJobs.value.reduce((sum, item) => sum + Number(item.budget || 0), 0))
const filteredRequests = computed(() => {
  const q = searchTerm.value.toLowerCase().trim()
  if (!q) return providerRequests.value
  return providerRequests.value.filter(item => `${item.serviceTitle} ${item.customerName} ${item.location} ${item.status} ${item.providerStatus}`.toLowerCase().includes(q))
})

function chatStatus(requestId) { return props.chatApprovals.find(item => item.requestId === requestId)?.status || 'not-requested' }
function acceptRequest(request) { emit('accept-request', { requestId: request.id, providerId: props.currentUser?.id }) }
function startJob(request) { emit('status-change', { requestId: request.id, status: 'in-progress' }) }
function completeJob(request) { emit('status-change', { requestId: request.id, status: 'completed' }) }
function openDeclineModal(request) { declineTarget.value = request; declineReason.value = '' }
function confirmDecline() {
  if (!declineReason.value.trim()) return
  emit('decline-request', { requestId: declineTarget.value.id, providerId: props.currentUser?.id, reason: declineReason.value })
  declineTarget.value = null
}
function requestChat(request) { emit('request-chat', { requestId: request.id, requestedBy: 'provider' }) }
function submitMessage(requestId) {
  const message = messageByRequest.value[requestId]
  if (!message?.trim()) return
  emit('send-message', { requestId, senderRole: 'provider', message })
  messageByRequest.value[requestId] = ''
}
function saveReply() {
  if (!replyText.value.trim()) return
  replyTarget.value.reply = replyText.value
  replyTarget.value = null
  replyText.value = ''
}
function addService() {
  if (!newService.title || !newService.price) return
  providerServices.value.unshift({ id: Date.now(), ...newService, price: Number(newService.price) })
  Object.assign(newService, { title: '', price: '', duration: '', active: true })
  showServiceModal.value = false
}
function requestCustomerBlock() {
  if (!blockTargetName.value.trim() || !blockReason.value.trim()) return
  emit('block-request', { targetName: blockTargetName.value, targetRole: 'customer', reason: blockReason.value })
  blockTargetName.value = ''; blockReason.value = ''
}
</script>

<template>
  <section class="ops-layout modern-ops-layout">
    <aside class="ops-sidebar modern-sidebar">
      <div class="ops-user compact-user">
        <div class="avatar">{{ avatarText }}</div>
        <div><strong>{{ displayName }}</strong><small>{{ providerService }}</small></div>
      </div>

      <nav class="ops-menu modern-menu">
        <button :class="{ active: activeView === 'dashboard' }" @click="activeView = 'dashboard'">Dashboard</button>
        <button :class="{ active: activeView === 'services' }" @click="activeView = 'services'">My services</button>
        <button :class="{ active: activeView === 'requests' }" @click="activeView = 'requests'">Requests</button>
        <button :class="{ active: activeView === 'messages' }" @click="activeView = 'messages'">Messages</button>
        <button :class="{ active: activeView === 'reviews' }" @click="activeView = 'reviews'">Reviews</button>
        <button :class="{ active: activeView === 'settings' }" @click="activeView = 'settings'">Settings</button>
      </nav>

      <div class="ops-bottom modern-bottom">
        <button class="secondary" type="button" @click="$emit('toggle-theme')">{{ theme === 'dark' ? 'Light mode' :
          'Dark mode' }}</button>
        <span class="ops-role-pill">Provider</span>
        <button class="danger-soft" type="button" @click="$emit('sign-out')">Log out</button>
      </div>
    </aside>

    <main class="ops-main">
      <header class="ops-topbar">
        <div>
          <h1>{{ activeView === 'dashboard' ? 'Provider dashboard' : activeView }}</h1>
          <p>Manage services, assigned requests, reviews and approved customer chats.</p>
        </div><input v-model="searchTerm" aria-label="Search provider workspace" placeholder="Search provider workspace..." />
      </header>

      <template v-if="activeView === 'dashboard'">
        <div class="stat-grid four">
          <article class="stat-card"><span>Total earnings</span><strong>৳{{ monthlyEstimate.toLocaleString()
              }}</strong><small>active jobs estimate</small></article>
          <article class="stat-card"><span>Waiting acceptance</span><strong>{{ pendingRequests.length }}</strong>
          </article>
          <article class="stat-card"><span>Total assigned jobs</span><strong>{{ providerRequests.length }}</strong>
          </article>
          <article class="stat-card"><span>Average rating</span><strong>4.8</strong><small>{{ reviews.length }}
              reviews</small></article>
        </div>
        <div class="ops-grid two">
          <section class="ops-panel">
            <div class="panel-heading">
              <h2>Pending assigned requests</h2><button class="secondary small" @click="activeView = 'requests'">View
                all</button>
            </div>
            <div v-if="pendingRequests.length === 0" class="empty-state">No admin-assigned requests waiting for
              acceptance.</div>
            <article v-for="request in pendingRequests" :key="request.id" class="request-row">
              <div><strong>{{ request.serviceTitle }}</strong><small>{{ request.customerName }} · {{
                request.preferredDate }} · ৳{{ request.budget }}</small></div>
              <div class="row-actions"><button class="secondary small"
                  @click="openDeclineModal(request)">Decline</button><button class="primary small"
                  @click="acceptRequest(request)">Accept</button></div>
            </article>
          </section>
          <section class="ops-panel">
            <div class="panel-heading">
              <h2>Recent reviews</h2><button class="secondary small" @click="activeView = 'reviews'">View all</button>
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
          <article class="stat-card"><span>Total services</span><strong>{{ providerServices.length }}</strong></article>
          <article class="stat-card"><span>Active services</span><strong>{{providerServices.filter(s =>
            s.active).length }}</strong></article>
          <article class="stat-card"><span>Inactive services</span><strong>{{providerServices.filter(s =>
            !s.active).length }}</strong></article>
        </div>
        <section class="ops-panel">
          <div class="panel-heading">
            <h2>Your services</h2><button class="primary small" @click="showServiceModal = true">Add new
              service</button>
          </div>
          <article v-for="service in providerServices" :key="service.id" class="service-line">
            <div><strong>{{ service.title }}</strong>
              <p>Professional local service with clear pricing and availability.</p><small>৳{{ service.price }}+ · {{
                service.duration || 'flexible time' }}</small>
            </div><label class="switch"><input v-model="service.active" type="checkbox" /><span></span></label>
          </article>
        </section>
      </template>

      <template v-if="activeView === 'requests'">
        <div class="stat-grid four">
          <article class="stat-card"><span>Waiting</span><strong>{{ pendingRequests.length }}</strong></article>
          <article class="stat-card"><span>Active</span><strong>{{ activeJobs.length }}</strong></article>
          <article class="stat-card"><span>Completed</span><strong>{{ completedJobs.length }}</strong></article>
          <article class="stat-card"><span>Total</span><strong>{{ providerRequests.length }}</strong></article>
        </div>
        <section class="ops-panel">
          <h2>Assigned service requests</h2>
          <div v-if="filteredRequests.length === 0" class="empty-state">No requests assigned by admin yet.</div>
          <article v-for="request in filteredRequests" :key="request.id" class="large-request-row">
            <div>
              <h3>{{ request.serviceTitle }}</h3>
              <p>{{ request.customerName }} · {{ request.location }} · {{ request.preferredDate }}</p><small>{{
                request.details }}</small><small v-if="request.needsUpfrontPayment">Bank payment required: {{
                  request.bankName }} · {{ request.accountName }}</small>
            </div><strong>৳{{ request.budget }}</strong><span class="status-pill"
              :class="String(request.providerStatus || request.status).toLowerCase().replaceAll(' ', '-').replaceAll('_', '-')">{{
                request.providerStatus || request.status }}</span>
            <div class="row-actions"><button v-if="request.providerStatus === 'waiting-provider-acceptance'"
                class="secondary small" @click="openDeclineModal(request)">Decline</button><button
                v-if="request.providerStatus === 'waiting-provider-acceptance'" class="primary small"
                @click="acceptRequest(request)">Accept</button><button v-if="request.providerStatus === 'accepted'"
                class="primary small" @click="startJob(request)">Start job</button><button
                v-if="request.providerStatus === 'in-progress'" class="success small"
                @click="completeJob(request)">Complete</button></div>
          </article>
        </section>
      </template>

      <template v-if="activeView === 'messages'">
        <section class="ops-panel">
          <h2>Admin-approved chat rooms</h2>
          <div v-if="providerRequests.length === 0" class="empty-state">No assigned request conversations yet.</div>
          <article v-for="request in providerRequests" :key="request.id" class="review-row"><strong>{{
            request.customerName }} · {{ request.serviceTitle }}</strong><small>Chat status: {{ chatStatus(request.id)
              }}</small><button v-if="chatStatus(request.id) !== 'approved'" class="secondary small"
              @click="requestChat(request)">Request admin approval</button>
            <div v-else>
              <p v-for="m in messages.filter(item => item.requestId === request.id)" :key="m.id"><strong>{{ m.senderRole
                  }}:</strong> {{ m.message }}</p>
              <div class="form-actions"><input v-model="messageByRequest[request.id]"
                  placeholder="Message customer" /><button class="primary small"
                  @click="submitMessage(request.id)">Send</button></div>
            </div>
          </article>
        </section>
      </template>

      <template v-if="activeView === 'reviews'">
        <div class="stat-grid four">
          <article class="stat-card"><span>Average rating</span><strong>4.6</strong></article>
          <article class="stat-card"><span>Total reviews</span><strong>{{ reviews.length }}</strong></article>
          <article class="stat-card"><span>Response rate</span><strong>{{Math.round((reviews.filter(r =>
            r.reply).length / reviews.length) * 100) }}%</strong></article>
          <article class="stat-card"><span>Pending replies</span><strong>{{reviews.filter(r => !r.reply).length
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
          <p class="muted">Request to block a customer. Admin reviews it before action is applied.</p>
          <div class="settings-grid"><label>Customer name<input v-model="blockTargetName"
                placeholder="Customer name from request" /></label><label>Reason<input v-model="blockReason"
                placeholder="Reason for admin review" /></label></div><button class="secondary small mt-action"
            @click="requestCustomerBlock">Send block request</button>
        </section>
      </template>
    </main>

    <section v-if="declineTarget" class="modal-backdrop" @click.self="declineTarget = null">
      <div class="modal-card"><button class="icon-close" aria-label="Close modal"
          @click="declineTarget = null">×</button>
        <h2>Decline request</h2>
        <p class="muted">Provide a reason. This can be shared with admin/customer.</p><label>Reason<textarea
            v-model="declineReason" rows="4"
            placeholder="Schedule conflict, outside service area, unavailable items..."></textarea></label>
        <div class="form-actions"><button class="secondary" @click="declineTarget = null">Cancel</button><button
            class="danger" @click="confirmDecline">Decline request</button></div>
      </div>
    </section>
    <section v-if="replyTarget" class="modal-backdrop" @click.self="replyTarget = null">
      <div class="modal-card"><button class="icon-close" aria-label="Close modal" @click="replyTarget = null">×</button>
        <h2>Reply to review</h2><textarea v-model="replyText" rows="5"
          placeholder="Write a professional response..."></textarea>
        <div class="form-actions"><button class="secondary" @click="replyTarget = null">Cancel</button><button
            class="primary" @click="saveReply">Save reply</button></div>
      </div>
    </section>
    <section v-if="showServiceModal" class="modal-backdrop" @click.self="showServiceModal = false">
      <div class="modal-card"><button class="icon-close" aria-label="Close modal"
          @click="showServiceModal = false">×</button>
        <h2>Add new service</h2>
        <div class="form-grid"><label class="full">Service title<input v-model="newService.title"
              placeholder="Example: Deep AC Cleaning" /></label><label>Starting price<input v-model="newService.price"
              type="number" placeholder="৳" /></label><label>Duration<input v-model="newService.duration"
              placeholder="Example: 1-2 hours" /></label></div>
        <div class="form-actions"><button class="secondary" @click="showServiceModal = false">Cancel</button><button
            class="primary" @click="addService">Save service</button></div>
      </div>
    </section>
  </section>
</template>
