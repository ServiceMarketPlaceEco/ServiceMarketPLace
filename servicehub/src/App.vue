<script setup>
// Root controller: owns simple routing, signed-in user state, service flow, requests, user location and theme.
import { computed, onMounted, ref } from 'vue'

import NavBar from './components/NavBar.vue'
import HeroSection from './components/HeroSection.vue'
import ServiceFlow from './components/ServiceFlow.vue'
import RequestForm from './components/RequestForm.vue'
import CustomerDashboard from './components/CustomerDashboard.vue'
import ProviderDashboard from './components/ProviderDashboard.vue'
import AdminDashboard from './components/AdminDashboard.vue'
import HowItWorksPage from './components/HowItWorksPage.vue'
import RegisterPage from './components/RegisterPage.vue'
import SignInPage from './components/SignInPage.vue'
import FooterSection from './components/FooterSection.vue'
import { services } from './data/services.js'

const activePage = ref('home')
const flowMode = ref('services')
const selectedService = ref(null)
const selectedTask = ref('')
const selectedLocation = ref('Rajshahi City')
const showLocationModal = ref(false)
const currentUser = ref(null)
const loginError = ref('')
const theme = ref('light')

// These locations are kept in App.vue so registration, navbar and request form share the same source.
const locations = ['Rajshahi City', 'Boalia', 'Shaheb Bazar', 'Laxmipur', 'Motihar', 'Kazla', 'Uposhohor', 'Rajshahi University Area', 'Paba nearby', 'Godagari nearby']

// Prototype accounts. Later this array can be replaced by database/API users.
const registeredUsers = ref([
  { username: 'customer', password: '1234', role: 'customer', name: 'Customer', phone: '01700000000', location: 'Rajshahi City' },
  { username: 'provider', password: '2222', role: 'provider', name: 'Abdul Karim', phone: '01800000000', location: 'Boalia' },
  { username: 'admin', password: '1111', role: 'admin', name: 'Admin Panel', phone: '01900000000', location: 'Rajshahi City' }
])

// Request records are created by real signed-in customers 
const bookings = ref([])

// Block requests are created by customers/providers and reviewed by admin.
const blockRequests = ref([])

const isOpsPage = computed(() => activePage.value === 'admin' || activePage.value === 'provider')

// Customer dashboard only displays the signed-in customer's own requests.
const customerBookings = computed(() => {
  if (!currentUser.value) return []
  return bookings.value.filter((booking) => booking.customerId === currentUser.value.username)
})

// The displayed location belongs to the signed-in user. Guests use the global selected location.
const displayLocation = computed(() => currentUser.value?.location || selectedLocation.value)

function applyTheme(value) {
  theme.value = value
  localStorage.setItem('servicehub-theme', value)
  document.documentElement.setAttribute('data-theme', value)
}

function toggleTheme() {
  applyTheme(theme.value === 'light' ? 'dark' : 'light')
}

onMounted(() => {
  applyTheme(localStorage.getItem('servicehub-theme') || 'light')
})

function goHome() {
  activePage.value = 'home'
  flowMode.value = 'services'
  selectedService.value = null
  selectedTask.value = ''
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function goServices() {
  activePage.value = 'services'
  flowMode.value = 'services'
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function goHowItWorks() {
  activePage.value = 'how'
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function goDashboard() {
  if (!currentUser.value) {
    activePage.value = 'signin'
    return
  }
  activePage.value = currentUser.value.role === 'admin' ? 'admin' : currentUser.value.role === 'provider' ? 'provider' : 'dashboard'
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function selectService(service) {
  selectedService.value = service
  selectedTask.value = ''
  flowMode.value = 'detail'
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

// Guests can browse services, but they must sign in/register before opening the request form.
function selectTask(task) {
  selectedTask.value = task
  if (!currentUser.value) {
    loginError.value = 'Please sign in or create an account before requesting a service.'
    activePage.value = 'signin'
    return
  }
  if (currentUser.value.role !== 'customer') {
    loginError.value = 'Only customer accounts can request services.'
    activePage.value = 'signin'
    return
  }
  activePage.value = 'request'
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function submitRequest(payload) {
  if (!currentUser.value) {
    activePage.value = 'signin'
    return
  }

  // The form location follows the user location shown in the navbar unless the customer changes it first.
  bookings.value.unshift({
    id: `REQ-${Date.now().toString().slice(-6)}`,
    serviceTitle: selectedService.value?.title || payload.serviceTitle || 'Selected service',
    task: selectedTask.value || payload.task || 'General request',
    provider: 'Unassigned',
    customerId: currentUser.value.username,
    customerName: currentUser.value.name,
    phone: payload.phone || currentUser.value.phone,
    city: displayLocation.value,
    area: payload.area || displayLocation.value,
    address: payload.address,
    date: payload.date,
    time: payload.time,
    payment: payload.payment,
    total: Number(payload.budget || selectedService.value?.price || 0),
    status: 'Pending',
    notes: payload.details
  })

  goDashboard()
}

function register(payload) {
  const username = payload.phone.replace(/\D/g, '')
  const user = {
    username,
    password: payload.password,
    role: 'customer',
    name: payload.name,
    phone: payload.phone,
    location: payload.location
  }
  registeredUsers.value.push(user)
  currentUser.value = user
  selectedLocation.value = user.location
  activePage.value = 'dashboard'
}

function signIn({ username, password }) {
  loginError.value = ''
  const user = registeredUsers.value.find((account) => account.username.toLowerCase() === username.trim().toLowerCase() && account.password === password)
  if (!user) {
    loginError.value = 'Invalid login. Try customer/1234, provider/2222, admin/1111, or your registered phone number.'
    return
  }
  currentUser.value = user
  selectedLocation.value = user.location || selectedLocation.value
  goDashboard()
}

// Demo-only Google auth stub: in production, replace this with Firebase Auth or Google OAuth callback.
function googleAuth() {
  window.location.href = 'https://accounts.google.com/'
}

function signOut() {
  currentUser.value = null
  loginError.value = ''
  goHome()
}

function updateStatus({ id, status }) {
  const booking = bookings.value.find((item) => item.id === id)
  if (!booking) return
  booking.status = status
  if (status === 'Accepted') booking.provider = currentUser.value?.name || 'Assigned provider'
}

function chooseLocation(location) {
  selectedLocation.value = location
  if (currentUser.value) currentUser.value.location = location
  showLocationModal.value = false
}

function createBlockRequest(payload) {
  if (!currentUser.value) return
  blockRequests.value.unshift({
    id: `BLK-${Date.now().toString().slice(-6)}`,
    requesterId: currentUser.value.username,
    requesterName: currentUser.value.name,
    requesterRole: currentUser.value.role,
    targetName: payload.targetName,
    targetRole: payload.targetRole,
    reason: payload.reason,
    status: 'Pending'
  })
}

function updateBlockRequest({ id, status }) {
  const item = blockRequests.value.find((request) => request.id === id)
  if (item) item.status = status
}
</script>

<template>
  <NavBar v-if="!isOpsPage" :signed-in="!!currentUser" :active-page="activePage"
    :user-role="currentUser?.role || 'customer'" :user-name="currentUser?.name || ''" :location="displayLocation"
    :theme="theme" @go-home="goHome" @go-dashboard="goDashboard" @find-services="goServices"
    @how-it-works="goHowItWorks" @sign-in="activePage = 'signin'" @register="activePage = 'register'"
    @sign-out="signOut" @open-location="showLocationModal = true" @toggle-theme="toggleTheme" />

  <main>
    <HeroSection v-if="activePage === 'home'" :location="displayLocation" @find-services="goServices"
      @view-dashboard="goDashboard" />

    <ServiceFlow v-if="activePage === 'services'" :services="services" :mode="flowMode"
      :selected-service="selectedService" @select-service="selectService" @select-task="selectTask"
      @back="flowMode = 'services'" />

    <RequestForm v-if="activePage === 'request'" :selected-service="selectedService" :selected-task="selectedTask"
      :selected-location="displayLocation" :locations="locations" @back="activePage = 'services'"
      @change-location="showLocationModal = true" @submit-request="submitRequest" />

    <HowItWorksPage v-if="activePage === 'how'" />

    <RegisterPage v-if="activePage === 'register'" :locations="locations" @register="register"
      @go-signin="activePage = 'signin'" @google-auth="googleAuth" />

    <SignInPage v-if="activePage === 'signin'" :error="loginError" @sign-in="signIn"
      @go-register="activePage = 'register'" @google-auth="googleAuth" />

    <CustomerDashboard v-if="activePage === 'dashboard'" :requests="customerBookings"
      :user-name="currentUser?.name || 'Customer'" @new-request="goServices" @block-request="createBlockRequest" />

    <ProviderDashboard v-if="activePage === 'provider'" :requests="bookings"
      :provider-name="currentUser?.name || 'Provider'" @status-change="updateStatus" @block-request="createBlockRequest"
      @sign-out="signOut" @go-home="goHome" />

    <AdminDashboard v-if="activePage === 'admin'" :requests="bookings" :block-requests="blockRequests"
      @status-change="updateStatus" @block-status-change="updateBlockRequest" @sign-out="signOut" @go-home="goHome" />
  </main>

  <FooterSection v-if="!isOpsPage" />

  <section v-if="showLocationModal" class="modal-backdrop" @click.self="showLocationModal = false">
    <div class="location-modal clean-card">
      <button class="icon-close" @click="showLocationModal = false">Close</button>
      <p class="eyebrow">service area</p>
      <h2>Choose your Rajshahi location</h2>
      <p class="muted">This area becomes your account location and automatically fills the request form.</p>
      <div class="location-grid">
        <button v-for="location in locations" :key="location" class="location-option"
          :class="{ selected: displayLocation === location }" @click="chooseLocation(location)">
          <strong>{{ location }}</strong>
          <span>Use as my request location</span>
        </button>
      </div>
    </div>
  </section>
</template>
