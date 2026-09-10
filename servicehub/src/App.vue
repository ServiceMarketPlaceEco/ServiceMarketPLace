<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { services } from './data/services'

import NavBar from './components/User/NavBar.vue'
import HeroSection from './components/User/HeroSection.vue'
import ServiceGrid from './components/User/ServiceGrid.vue'
import HowItWorksPage from './components/User/HowItWorksPage.vue'
import SignInPage from './components/User/SignInPage.vue'
import RegisterPage from './components/User/RegisterPage.vue'
import ProviderRegisterPage from './components/Provider/ProviderRegisterPage.vue'
import RequestForm from './components/User/RequestForm.vue'
import CustomerDashboard from './components/User/CustomerDashboard.vue'
import ProviderDashboard from './components/Provider/ProviderDashboard.vue'
import AdminDashboard from './components/Admin/AdminDashboard.vue'
import TrackingDemo from './components/User/TrackingDemo.vue'
import FooterSection from './components/User/FooterSection.vue'
import AIChatbot from './components/AI/AIChatbot.vue'
import LandingHighlights from './components/User/LandingHighlights.vue'
import ReviewsPage from './components/User/ReviewsPage.vue'

// Starter reviews keep the public landing page useful before users add reviews.
const defaultReviews = [
  { id: 'REV-01', name: 'Sabrina Rahman', role: 'customer', serviceId: 'cleaning', serviceTitle: 'Home Cleaning', rating: 5, comment: 'The provider arrived on time and completed everything carefully.' },
  { id: 'REV-02', name: 'Rafiq Ahmed', role: 'customer', serviceId: 'ac-repair', serviceTitle: 'AC Repair', rating: 5, comment: 'Clear communication, professional work and helpful status updates.' },
  { id: 'REV-03', name: 'Nusrat Jahan', role: 'customer', serviceId: 'delivery', serviceTitle: 'Local Delivery', rating: 4, comment: 'Easy to request and I could follow the service progress.' }
]

// localStorage keeps the demo workflow usable after browser refresh.
const savedRequests = JSON.parse(localStorage.getItem('servicehub-requests') || '[]')
const savedAccounts = JSON.parse(localStorage.getItem('servicehub-accounts') || '[]')
const savedChats = JSON.parse(localStorage.getItem('servicehub-chat-approvals') || '[]')
const savedMessages = JSON.parse(localStorage.getItem('servicehub-messages') || '[]')
const savedBlocks = JSON.parse(localStorage.getItem('servicehub-block-requests') || '[]')
const savedUser = JSON.parse(localStorage.getItem('servicehub-user') || 'null')
const savedReviews = JSON.parse(
  localStorage.getItem('servicehub-reviews') || JSON.stringify(defaultReviews)
)

const currentPage = ref(savedUser ? 'dashboard' : 'home')
const theme = ref(localStorage.getItem('servicehub-theme') || 'light')
const signedInUser = ref(savedUser)
const selectedService = ref(null)
const requests = ref(savedRequests)
const accounts = ref(savedAccounts)
const chatApprovals = ref(savedChats)
const messages = ref(savedMessages)
const blockRequests = ref(savedBlocks)
const reviews = ref(savedReviews)
const appMain = ref(null)

document.documentElement.dataset.theme = theme.value

watch(theme, value => {
  document.documentElement.dataset.theme = value
  localStorage.setItem('servicehub-theme', value)
})
watch(requests, value => localStorage.setItem('servicehub-requests', JSON.stringify(value)), { deep: true })
watch(accounts, value => localStorage.setItem('servicehub-accounts', JSON.stringify(value)), { deep: true })
watch(chatApprovals, value => localStorage.setItem('servicehub-chat-approvals', JSON.stringify(value)), { deep: true })
watch(messages, value => localStorage.setItem('servicehub-messages', JSON.stringify(value)), { deep: true })
watch(blockRequests, value => localStorage.setItem('servicehub-block-requests', JSON.stringify(value)), { deep: true })
watch(reviews, value => localStorage.setItem('servicehub-reviews', JSON.stringify(value)), { deep: true })
watch(signedInUser, value => {
  if (value) localStorage.setItem('servicehub-user', JSON.stringify(value))
  else localStorage.removeItem('servicehub-user')
}, { deep: true })

// Move every newly rendered page to its beginning and place keyboard focus on
// the main content. nextTick is important because Vue must render the new page
// before its position and focus can be reset.
watch(currentPage, async () => {
  await nextTick()
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  appMain.value?.focus({ preventScroll: true })
})

const isOpsDashboard = computed(() => currentPage.value === 'dashboard' && ['admin', 'provider'].includes(signedInUser.value?.role))

function goTo(page) {
  // Service discovery, voice search and booking are customer-only areas.
  if (page === 'services' && signedInUser.value?.role !== 'customer') {
    currentPage.value = 'signin'
    return
  }

  currentPage.value = page
}
function toggleTheme() { theme.value = theme.value === 'dark' ? 'light' : 'dark' }
function signOut() { signedInUser.value = null; currentPage.value = 'home' }

function upsertAccount(account) {
  const index = accounts.value.findIndex(item => item.id === account.id)
  if (index >= 0) accounts.value[index] = account
  else accounts.value.unshift(account)
}

function createAccount(user) {
  const account = {
    id: `CUS-${Date.now()}`,
    role: 'customer',
    status: 'active',
    name: user.name || 'Google Customer',
    username: user.username || user.phone,
    email: user.email || `${user.phone || 'customer'}@servicehub.local`,
    phone: user.phone || '01XXXXXXXXX',
    location: user.location || 'Rajshahi',
    authProvider: user.authProvider || 'email'
  }
  upsertAccount(account)
  signedInUser.value = account
  currentPage.value = 'dashboard'
}

function createProvider(provider) {
  const account = {
    id: `PROV-${Date.now()}`,
    role: 'provider',
    status: 'pending-admin-approval',
    name: provider.name,
    username: provider.username,
    email: provider.email,
    phone: provider.phone,
    area: provider.suburb || provider.area || 'Rajshahi City',
    serviceType: provider.serviceType || 'General service',
    experience: provider.experience,
    authProvider: provider.authProvider || 'email'
  }
  upsertAccount(account)
  signedInUser.value = account
  currentPage.value = 'dashboard'
}

function signIn(payload) {
  // A matching stored account is the source of truth for its role. This means
  // returning customers/providers reach the correct dashboard even if the UI
  // sends no role or an outdated role selection.
  const identifier = (payload.identifier || payload.email || '').trim().toLowerCase()
  const existingAccount = accounts.value.find(account =>
    [account.username, account.email, account.id, account.phone, account.name]
      .filter(Boolean)
      .some(value => String(value).trim().toLowerCase() === identifier)
  )
  // Temporary frontend fallback until the backend returns the authenticated
  // account. Provider usernames begin with PR; admin demo IDs begin with ADM.
  const inferredRole = identifier.startsWith('pr')
    ? 'provider'
    : identifier.startsWith('adm') || identifier.startsWith('admin')
      ? 'admin'
      : 'customer'
  const role = existingAccount?.role || inferredRole

  if (existingAccount) {
    signedInUser.value = existingAccount
    currentPage.value = 'dashboard'
    return
  }

  if (role === 'admin') {
    signedInUser.value = { id: 'ADMIN-01', role: 'admin', status: 'active', name: 'Admin User', email: 'admin@servicehub.local' }
  } else if (role === 'provider') {
    signedInUser.value = { id: identifier.toUpperCase() || 'PR-DEMO-01', role: 'provider', status: 'active', name: identifier || 'Rajshahi Provider', username: identifier, email: payload.email || 'provider@servicehub.local', serviceType: 'AC Repair & Home Maintenance', area: 'Rajshahi City' }
    upsertAccount(signedInUser.value)
  } else {
    signedInUser.value = { id: `CUS-${Date.now()}`, role: 'customer', status: 'active', name: payload.name || identifier || 'Google Customer', username: identifier, email: payload.email || (identifier.includes('@') ? identifier : 'customer@servicehub.local'), phone: payload.phone || (identifier.startsWith('01') ? identifier : '01XXXXXXXXX'), location: 'Rajshahi City' }
    upsertAccount(signedInUser.value)
  }
  currentPage.value = 'dashboard'
}

function openRequest(service) {
  // Only customers can progress from service discovery to a booking request.
  if (signedInUser.value?.role !== 'customer') {
    currentPage.value = 'signin'
    return
  }

  selectedService.value = service
  currentPage.value = 'request'
}

function submitReview(review) {
  reviews.value.unshift({
    id: `REV-${Date.now()}`,
    name: signedInUser.value?.name || 'ServiceHub user',
    role: signedInUser.value?.role || 'guest',
    createdAt: new Date().toLocaleString(),
    ...review
  })
}

function submitRequest(form) {
  requests.value.unshift({
    id: `REQ-${Date.now()}`,
    ...form,
    customerId: signedInUser.value.id,
    customerName: signedInUser.value.name,
    customerLocation: signedInUser.value.location,
    status: 'waiting-admin-approval',
    providerStatus: 'unassigned',
    createdAt: new Date().toLocaleString()
  })
  currentPage.value = 'dashboard'
}

function approveProvider(providerId) {
  const provider = accounts.value.find(item => item.id === providerId)
  if (provider) provider.status = 'active'
}
function rejectProvider(providerId) {
  const provider = accounts.value.find(item => item.id === providerId)
  if (provider) provider.status = 'rejected'
}
function assignRequest({ requestId, providerId }) {
  const request = requests.value.find(item => item.id === requestId)
  if (!request) return
  request.providerId = providerId
  request.status = 'assigned-to-provider'
  request.providerStatus = 'waiting-provider-acceptance'
}
function acceptProviderRequest({ requestId, providerId }) {
  const request = requests.value.find(item => item.id === requestId)
  if (!request) return
  request.providerId = providerId || request.providerId
  request.status = 'provider-accepted'
  request.providerStatus = 'accepted'
}
function declineProviderRequest({ requestId, reason }) {
  const request = requests.value.find(item => item.id === requestId)
  if (!request) return
  request.status = 'provider-declined'
  request.providerStatus = 'declined'
  request.declineReason = reason
}
function changeRequestStatus({ requestId, status }) {
  const request = requests.value.find(item => item.id === requestId)
  if (!request) return
  request.status = status === 'completed' ? 'completed' : request.status
  request.providerStatus = status
}
function requestChat(payload) {
  if (chatApprovals.value.some(item => item.requestId === payload.requestId)) return
  chatApprovals.value.unshift({ id: `CHAT-${Date.now()}`, status: 'pending', ...payload })
}
function approveChat(id) {
  const approval = chatApprovals.value.find(item => item.id === id)
  if (approval) approval.status = 'approved'
}
function rejectChat(id) {
  const approval = chatApprovals.value.find(item => item.id === id)
  if (approval) approval.status = 'rejected'
}
function sendMessage(payload) {
  messages.value.push({ id: `MSG-${Date.now()}`, createdAt: new Date().toLocaleString(), ...payload })
}
function createBlockRequest(payload) {
  blockRequests.value.unshift({ id: `BLK-${Date.now()}`, requesterName: signedInUser.value?.name, requesterRole: signedInUser.value?.role, status: 'Pending', ...payload })
}
function updateBlockRequest({ id, status }) {
  const request = blockRequests.value.find(item => item.id === id)
  if (request) request.status = status
}
function resetLocalDemo() {
  requests.value = []
  chatApprovals.value = []
  messages.value = []
  blockRequests.value = []
}
</script>

<template>
  <div class="app-shell">
    <NavBar
      v-if="!isOpsDashboard"
      :active-page="currentPage"
      :signed-in-user="signedInUser"
      :theme="theme"
      @navigate="goTo"
      @sign-out="signOut"
      @toggle-theme="toggleTheme"
    />

    <main ref="appMain" class="app-main" tabindex="-1">
      <template v-if="currentPage === 'home'">
        <HeroSection
          @get-started="goTo('register')"
          @view-tracking="goTo('tracking')"
        />
        <LandingHighlights
          :reviews="reviews"
          @become-provider="goTo('provider-register')"
        />
      </template>

      <!-- ServiceGrid and VoiceSearch are available only to signed-in customers. -->
      <ServiceGrid
        v-else-if="currentPage === 'services' && signedInUser?.role === 'customer'"
        :services="services"
        @request-service="openRequest"
      />

      <HowItWorksPage v-else-if="currentPage === 'how'" />
      <ReviewsPage
        v-else-if="currentPage === 'reviews'"
        :reviews="reviews"
        :services="services"
        :signed-in-user="signedInUser"
        @submit-review="submitReview"
      />
      <SignInPage v-else-if="currentPage === 'signin'" @sign-in="signIn" @go-register="goTo('register')" />
      <RegisterPage v-else-if="currentPage === 'register'" @create-account="createAccount" @google-create-account="createAccount" @go-signin="goTo('signin')" />
      <ProviderRegisterPage v-else-if="currentPage === 'provider-register'" @created="createProvider" @google-create="createProvider" @go="goTo" />
      <RequestForm v-else-if="currentPage === 'request'" :service="selectedService" :customer="signedInUser" @submit-request="submitRequest" @back="goTo('services')" />

      <CustomerDashboard v-else-if="currentPage === 'dashboard' && signedInUser?.role === 'customer'" :customer="signedInUser" :requests="requests" @request-another="goTo('services')" @view-tracking="goTo('tracking')" />

      <ProviderDashboard
        v-else-if="currentPage === 'dashboard' && signedInUser?.role === 'provider'"
        :current-user="signedInUser"
        :requests="requests"
        :chat-approvals="chatApprovals"
        :messages="messages"
        :theme="theme"
        @toggle-theme="toggleTheme"
        @sign-out="signOut"
        @go-home="goTo('home')"
        @accept-request="acceptProviderRequest"
        @decline-request="declineProviderRequest"
        @status-change="changeRequestStatus"
        @request-chat="requestChat"
        @send-message="sendMessage"
        @block-request="createBlockRequest"
      />

      <AdminDashboard
        v-else-if="currentPage === 'dashboard' && signedInUser?.role === 'admin'"
        :accounts="accounts"
        :requests="requests"
        :chat-approvals="chatApprovals"
        :block-requests="blockRequests"
        :theme="theme"
        @toggle-theme="toggleTheme"
        @sign-out="signOut"
        @go-home="goTo('home')"
        @approve-provider="approveProvider"
        @reject-provider="rejectProvider"
        @assign-request="assignRequest"
        @approve-chat="approveChat"
        @reject-chat="rejectChat"
        @block-status-change="updateBlockRequest"
        @reset-db="resetLocalDemo"
      />

      <TrackingDemo v-else-if="currentPage === 'tracking'" :requests="requests" :signed-in-user="signedInUser" @back="goTo(signedInUser ? 'dashboard' : 'home')" />
    </main>

    <!-- The assistant stays available on public pages and every dashboard. -->
    <AIChatbot
      :signed-in-user="signedInUser"
      :requests="requests"
      :services="services"
      :current-page="currentPage"
      @navigate="goTo"
    />

    <FooterSection v-if="!isOpsDashboard" />
  </div>
</template>
