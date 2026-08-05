<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import * as api from './services/api'

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
import AIChatbot from './components/User/AIChatbot.vue'

// Fixed password used for the one-click "demo" sign-in shortcuts, so they
// satisfy the backend's password policy without showing any new UI.
const DEMO_PASSWORD = 'GoogleDemo@123'

// Presentation-only details the backend doesn't store (images, upfront
// payment terms). Matched by service name so the catalog still looks the
// same as the old mock data once it's loaded from the real API.
const SERVICE_PRESENTATION = {
  'home cleaning': {
    image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952'
  },
  'moving help': {
    image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c',
    upfrontPayment: {
      required: true,
      amount: 300,
      bankName: 'BRAC Bank',
      accountName: 'ServiceHub Moving Provider',
      accountNumber: '01700000001',
      note: 'Moving jobs require a small provider deposit before vehicle scheduling.'
    }
  },
  'local delivery': {
    image: 'https://images.unsplash.com/photo-1604357209793-fca5dca89f97'
  },
  'tech support': {
    image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3'
  },
  'ac repair': {
    image: 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4',
    upfrontPayment: {
      required: true,
      amount: 250,
      bankName: 'Dutch-Bangla Bank',
      accountName: 'Rajshahi AC Provider',
      accountNumber: '01800000002',
      note: 'AC repair requires an inspection booking deposit before provider dispatch.'
    }
  },
  'electrician': {
    image: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e',
    upfrontPayment: {
      required: true,
      amount: 200,
      bankName: 'City Bank',
      accountName: 'Rajshahi Electrical Provider',
      accountNumber: '01900000003',
      note: 'Electrical work may require upfront inspection payment for safety scheduling.'
    }
  },
  'plumbing help': {
    image: 'https://images.unsplash.com/photo-1607472586893-edb57bdc0e39'
  },
  'home tutoring': {
    image: 'https://images.unsplash.com/photo-1509062522246-3755977927d7'
  },
  'elder care visit': {
    image: 'https://images.unsplash.com/photo-1584515933487-779824d29309'
  }
}
const DEFAULT_SERVICE_IMAGE = 'https://images.unsplash.com/photo-1581578731548-c64695cc6952'

// The original catalog order from the finalized frontend, so the homepage
// looks the same regardless of what order the backend returns rows in.
// ProviderRegisterPage's "Service type" dropdown uses its own labels that
// don't exactly match the service catalog's names (e.g. "Tutoring" vs.
// "Home Tutoring"), so map them before looking up a catalog match.
const PROVIDER_SERVICE_TYPE_MAP = {
  'ac repair & home maintenance': 'ac repair',
  'home cleaning': 'home cleaning',
  'moving help': 'moving help',
  'delivery service': 'local delivery',
  'technology support': 'tech support',
  'tutoring': 'home tutoring'
}

const SERVICE_DISPLAY_ORDER = [
  'home cleaning',
  'moving help',
  'local delivery',
  'tech support',
  'ac repair',
  'electrician',
  'plumbing help',
  'home tutoring',
  'elder care visit'
]

// Backend `services.icon` -> the category label the mock data used to group by.
const ICON_CATEGORY_MAP = {
  home: 'Home',
  truck: 'Transport',
  package: 'Errands',
  laptop: 'Technology',
  thermometer: 'Home repair',
  zap: 'Home repair',
  wrench: 'Home repair',
  book: 'Education',
  heart: 'Care'
}

// Backend BookingStatus (pending/confirmed/in_progress/completed/cancelled) mapped
// onto the two-field status vocabulary the dashboards were built around.
const STATUS_MAP = {
  pending: { status: 'waiting-admin-approval', providerStatus: 'waiting-provider-acceptance' },
  confirmed: { status: 'assigned-to-provider', providerStatus: 'accepted' },
  in_progress: { status: 'in-progress', providerStatus: 'in-progress' },
  completed: { status: 'completed', providerStatus: 'completed' },
  cancelled: { status: 'cancelled', providerStatus: 'declined' }
}

function clean(value) {
  return String(value || '').trim()
}

function digitsOnly(value) {
  const digits = String(value || '').replace(/\D/g, '')
  return digits ? Number(digits) : undefined
}

// localStorage keeps the demo workflow usable after browser refresh.
const savedUser = JSON.parse(localStorage.getItem('servicehub-user') || 'null')
const savedChats = JSON.parse(localStorage.getItem('servicehub-chat-approvals') || '[]')
const savedMessages = JSON.parse(localStorage.getItem('servicehub-messages') || '[]')

const currentPage = ref(savedUser ? 'dashboard' : 'home')
const theme = ref(localStorage.getItem('servicehub-theme') || 'light')
const signedInUser = ref(savedUser)
const selectedService = ref(null)
const services = ref([])
const requests = ref([])
const accounts = ref([])
const chatApprovals = ref(savedChats)
const messages = ref(savedMessages)
const blockRequests = ref([])
const providerServices = ref([])
const providerReviews = ref([])

document.documentElement.dataset.theme = theme.value

watch(theme, value => {
  document.documentElement.dataset.theme = value
  localStorage.setItem('servicehub-theme', value)
})
watch(chatApprovals, value => localStorage.setItem('servicehub-chat-approvals', JSON.stringify(value)), { deep: true })
watch(messages, value => localStorage.setItem('servicehub-messages', JSON.stringify(value)), { deep: true })
watch(signedInUser, value => {
  if (value) localStorage.setItem('servicehub-user', JSON.stringify(value))
  else localStorage.removeItem('servicehub-user')
}, { deep: true })

const isOpsDashboard = computed(() => currentPage.value === 'dashboard' && ['admin', 'provider'].includes(signedInUser.value?.role))

function goTo(page) {
  currentPage.value = page
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
function toggleTheme() { theme.value = theme.value === 'dark' ? 'light' : 'dark' }
function signOut() {
  api.clearTokens()
  signedInUser.value = null
  currentPage.value = 'home'
}

// ---------- Data loading ----------

async function loadServices() {
  try {
    const catalog = await api.getServices()
    const withPricing = await Promise.all(catalog.map(async service => {
      const presentation = SERVICE_PRESENTATION[service.serviceName.toLowerCase()] || {}
      let providers = []
      try {
        providers = await api.getServiceProviders(service.serviceId)
      } catch {
        providers = []
      }
      const bestOffer = providers[0] || null

      return {
        id: bestOffer?.providerServiceId || service.serviceId,
        serviceId: service.serviceId,
        providerServiceId: bestOffer?.providerServiceId || null,
        providerId: bestOffer?.providerId || null,
        providerName: bestOffer?.providerName || '',
        title: service.serviceName,
        category: ICON_CATEGORY_MAP[service.icon] || 'General',
        price: bestOffer?.price ?? 0,
        currency: 'BDT',
        image: presentation.image || DEFAULT_SERVICE_IMAGE,
        description: service.description || '',
        upfrontPayment: presentation.upfrontPayment || null
      }
    }))

    // Only show the original 9 services, in the original order, so the
    // homepage matches the finalized frontend regardless of any extra
    // categories that might exist in the database.
    services.value = SERVICE_DISPLAY_ORDER
      .map(name => withPricing.find(s => s.title.toLowerCase() === name))
      .filter(Boolean)
  } catch (err) {
    console.warn('Could not load services catalog:', err.message)
  }
}

function normalizeUser(user, userType) {
  if (userType === 'customer') {
    return {
      id: user.customerId,
      role: 'customer',
      name: user.name,
      email: user.email,
      phone: user.phone,
      location: user.address || 'Rajshahi City'
    }
  }
  if (userType === 'provider') {
    return {
      id: user.providerId,
      role: 'provider',
      name: user.providerName,
      email: user.email,
      phone: user.phone,
      area: user.address || 'Rajshahi City',
      serviceType: 'General service',
      status: user.isVerified ? 'active' : 'pending-admin-approval'
    }
  }
  return {
    id: user.id,
    role: 'admin',
    name: user.name,
    email: user.email
  }
}

function normalizeBooking(booking) {
  const mapped = STATUS_MAP[booking.status] || { status: booking.status, providerStatus: booking.status }
  const providerService = booking.providerService

  return {
    id: booking.bookingId,
    serviceTitle: booking.serviceName || providerService?.service?.serviceName || booking.notes || 'Service request',
    details: booking.notes || '',
    location: booking.address || 'Rajshahi',
    customerLocation: booking.customer?.address || 'Rajshahi',
    preferredDate: booking.date,
    createdAt: booking.createdAt,
    budget: Number(booking.totalAmount || 0),
    customerId: booking.customerId,
    customerName: booking.customer?.name || '',
    providerId: providerService?.providerId || '',
    providerServiceId: booking.providerServiceId,
    status: mapped.status,
    providerStatus: mapped.providerStatus,
    needsUpfrontPayment: false,
    bankName: '',
    accountName: '',
    paymentNote: ''
  }
}

async function refreshBookings() {
  if (!signedInUser.value) {
    requests.value = []
    return
  }
  try {
    let raw = []
    if (signedInUser.value.role === 'customer') raw = await api.getMyBookings()
    else if (signedInUser.value.role === 'provider') raw = await api.getProviderBookings()
    else raw = await api.getAllBookingsPublic()
    requests.value = raw.map(normalizeBooking)
  } catch (err) {
    console.warn('Could not load bookings:', err.message)
  }
}

async function refreshAdminAccounts() {
  if (signedInUser.value?.role !== 'admin') return
  try {
    const [customersRes, providersRes] = await Promise.all([
      api.getAllCustomersAdmin(),
      api.getAllProvidersAdmin()
    ])
    const customerAccounts = customersRes.data.map(c => ({
      id: c.customerId,
      role: 'customer',
      name: c.name,
      email: c.email,
      phone: c.phone,
      status: c.isActive ? 'active' : 'blocked'
    }))
    const providerAccounts = providersRes.data.map(p => ({
      id: p.providerId,
      role: 'provider',
      name: p.providerName,
      email: p.email,
      phone: p.phone,
      area: 'Rajshahi City',
      serviceType: 'General service',
      status: !p.isActive ? 'blocked' : (p.isVerified ? 'active' : 'pending-admin-approval')
    }))
    accounts.value = [...customerAccounts, ...providerAccounts]
  } catch (err) {
    console.warn('Could not load accounts:', err.message)
  }
}

async function refreshAdminReports() {
  if (signedInUser.value?.role !== 'admin') return
  try {
    const raw = await api.getAllReportsAdmin()
    const statusLabel = { pending: 'Pending', reviewed: 'Reviewed', resolved: 'Approved', dismissed: 'Rejected' }
    blockRequests.value = raw.map(r => {
      const reporter = accounts.value.find(a => a.id === r.reporterId)
      const target = accounts.value.find(a => a.id === r.reportedId)
      return {
        id: r.reportId,
        requesterName: reporter?.name || r.reporterType,
        requesterRole: r.reporterType,
        targetName: target?.name || r.reportedType,
        targetRole: r.reportedType,
        reason: r.reason,
        status: statusLabel[r.status] || r.status
      }
    })
  } catch (err) {
    console.warn('Could not load reports:', err.message)
  }
}

async function refreshProviderServices() {
  if (signedInUser.value?.role !== 'provider') return
  try {
    const raw = await api.getMyProviderServices()
    providerServices.value = raw.map(ps => ({
      id: ps.id,
      serviceId: ps.serviceId,
      title: ps.service?.serviceName || 'Service',
      price: Number(ps.price || 0),
      description: ps.description || '',
      active: ps.isAvailable
    }))
  } catch (err) {
    console.warn('Could not load provider services:', err.message)
  }
}

async function refreshProviderReviews() {
  if (signedInUser.value?.role !== 'provider') return
  try {
    const raw = await api.getProviderReviews(signedInUser.value.id)
    providerReviews.value = raw.map(r => ({
      id: r.reviewId,
      name: r.customer?.name || 'Customer',
      service: r.booking?.providerService?.service?.serviceName || 'Service',
      rating: r.rating,
      text: r.comment || ''
    }))
  } catch (err) {
    console.warn('Could not load reviews:', err.message)
  }
}

async function applySession(res, userType) {
  api.setTokens(res.accessToken, res.refreshToken)
  signedInUser.value = normalizeUser(res.user, userType)
  currentPage.value = 'dashboard'
  await refreshBookings()
  if (userType === 'admin') {
    await refreshAdminAccounts()
    await refreshAdminReports()
  }
  if (userType === 'provider') {
    await refreshProviderServices()
    await refreshProviderReviews()
  }
}

onMounted(async () => {
  await loadServices()
  if (signedInUser.value) {
    await refreshBookings()
    if (signedInUser.value.role === 'admin') {
      await refreshAdminAccounts()
      await refreshAdminReports()
    }
    if (signedInUser.value.role === 'provider') {
      await refreshProviderServices()
      await refreshProviderReviews()
    }
  }
})

// ---------- Accounts / auth ----------

async function createAccount(user) {
  try {
    const email = clean(user.email) || `${clean(user.name).toLowerCase().replace(/\s+/g, '.')}@servicehub.local`
    const res = await api.registerCustomer({
      name: user.name,
      email,
      password: user.password === 'google-demo' ? DEMO_PASSWORD : user.password,
      phone: user.phone,
      address: user.location
    })
    await applySession(res, 'customer')
  } catch (err) {
    alert(err.message || 'Registration failed.')
  }
}

async function createProvider(provider) {
  try {
    const email = clean(provider.email) || `${clean(provider.name).toLowerCase().replace(/\s+/g, '.')}@servicehub.local`
    const res = await api.registerProvider({
      providerName: provider.name || 'Google Provider',
      email,
      password: provider.password ? provider.password : DEMO_PASSWORD,
      phone: digitsOnly(provider.phone),
      address: provider.suburb || provider.area || 'Rajshahi City',
      description: provider.experience || undefined
    })
    await applySession(res, 'provider')

    const rawType = String(provider.serviceType || '').toLowerCase()
    const normalizedType = PROVIDER_SERVICE_TYPE_MAP[rawType] || rawType
    const match = services.value.find(s => s.title.toLowerCase() === normalizedType)
    if (match) {
      try {
        await api.addProviderService({
          serviceId: match.serviceId,
          price: match.price || 500,
          description: `${provider.serviceType} offered in ${provider.suburb || 'Rajshahi City'}`
        })
        await refreshProviderServices()
      } catch (err) {
        console.warn('Could not attach default service offering:', err.message)
      }
    }
  } catch (err) {
    alert(err.message || 'Provider registration failed.')
  }
}

async function signIn(payload) {
  const role = payload.role || 'customer'
  try {
    if (payload.password) {
      const res = await api.login({ email: payload.email, password: payload.password, userType: role })
      await applySession(res, role)
      return
    }

    // "Continue with Google demo" shortcut: no password typed, so try the
    // fixed demo credential first and auto-provision the account if needed.
    const email = payload.email || `${role}.demo@servicehub.local`
    try {
      const res = await api.login({ email, password: DEMO_PASSWORD, userType: role })
      await applySession(res, role)
    } catch {
      const res = await api.registerCustomer({
        name: payload.name || 'Google Customer',
        email,
        password: DEMO_PASSWORD,
        phone: '01700000002',
        address: 'Rajshahi City'
      })
      await applySession(res, 'customer')
    }
  } catch (err) {
    alert(err.message || 'Sign in failed.')
  }
}

// ---------- Bookings ----------

function openRequest(service) {
  selectedService.value = service
  currentPage.value = signedInUser.value ? 'request' : 'signin'
}

async function submitRequest(form) {
  try {
    await api.createBooking({
      providerServiceId: selectedService.value?.providerServiceId || undefined,
      serviceId: selectedService.value?.serviceId,
      date: form.preferredDate,
      time: form.preferredTime || '09:00',
      notes: form.details,
      address: form.location,
      serviceName: form.serviceTitle
    })
    await refreshBookings()
    currentPage.value = 'dashboard'
  } catch (err) {
    alert(err.message || 'Could not submit request.')
  }
}

// ---------- Admin actions ----------

async function approveProvider(providerId) {
  try {
    await api.verifyProvider(providerId)
    await refreshAdminAccounts()
  } catch (err) {
    alert(err.message || 'Could not approve provider.')
  }
}
async function rejectProvider(providerId) {
  try {
    await api.suspendUser('provider', providerId, 'Rejected by admin')
    await refreshAdminAccounts()
  } catch (err) {
    alert(err.message || 'Could not reject provider.')
  }
}
async function assignRequest({ requestId }) {
  try {
    await api.updateBookingStatusPublic(requestId, 'confirmed')
    await refreshBookings()
  } catch (err) {
    alert(err.message || 'Could not assign request.')
  }
}
async function activateProvider(providerId) {
  try {
    await api.activateUser('provider', providerId)
    await refreshAdminAccounts()
  } catch (err) {
    alert(err.message || 'Could not unblock provider.')
  }
}
async function blockCustomer(customerId) {
  try {
    await api.suspendUser('customer', customerId, 'Blocked by admin')
    await refreshAdminAccounts()
  } catch (err) {
    alert(err.message || 'Could not block customer.')
  }
}
async function activateCustomer(customerId) {
  try {
    await api.activateUser('customer', customerId)
    await refreshAdminAccounts()
  } catch (err) {
    alert(err.message || 'Could not unblock customer.')
  }
}

// ---------- Provider actions ----------

async function acceptProviderRequest({ requestId }) {
  try {
    await api.updateProviderBookingStatus(requestId, 'confirmed')
    await refreshBookings()
  } catch (err) {
    alert(err.message || 'Could not accept request.')
  }
}
async function declineProviderRequest({ requestId }) {
  try {
    await api.updateProviderBookingStatus(requestId, 'cancelled')
    await refreshBookings()
  } catch (err) {
    alert(err.message || 'Could not decline request.')
  }
}
async function changeRequestStatus({ requestId, status }) {
  const backendStatus = status === 'in-progress' ? 'in_progress' : status
  try {
    await api.updateProviderBookingStatus(requestId, backendStatus)
    await refreshBookings()
  } catch (err) {
    alert(err.message || 'Could not update request status.')
  }
}
async function addProviderServiceOffering({ serviceId, price, description }) {
  try {
    await api.addProviderService({ serviceId, price: Number(price), description })
    await refreshProviderServices()
  } catch (err) {
    alert(err.message || 'Could not add service.')
  }
}
async function toggleProviderService({ id, active }) {
  try {
    await api.updateProviderService(id, { isAvailable: active })
    await refreshProviderServices()
  } catch (err) {
    alert(err.message || 'Could not update service.')
  }
}

// ---------- Chat (kept as a local-only demo; no backend module exists for it) ----------

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

// ---------- Reports / block requests (real backend data) ----------

async function createBlockRequest(payload) {
  const match = requests.value.find(r => r.customerName === payload.requesterName || r.customerName === payload.targetName)
  const reportedId = signedInUser.value?.role === 'provider'
    ? requests.value.find(r => r.customerName === payload.targetName)?.customerId
    : match?.providerId

  if (!reportedId) {
    alert('Could not find a matching account from your bookings to report.')
    return
  }

  try {
    await api.createReport({
      reportedId,
      reportedType: payload.targetRole === 'provider' ? 'provider' : 'customer',
      reason: payload.reason
    })
    alert('Report submitted to admin.')
  } catch (err) {
    alert(err.message || 'Could not submit report.')
  }
}
async function updateBlockRequest({ id, status }) {
  const backendStatus = status === 'Approved' ? 'resolved' : 'dismissed'
  try {
    await api.updateReportStatus(id, backendStatus)
    await refreshAdminReports()
  } catch (err) {
    alert(err.message || 'Could not update report.')
  }
}

function resetLocalDemo() {
  chatApprovals.value = []
  messages.value = []
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

    <main class="app-main">
      <template v-if="currentPage === 'home'">
        <HeroSection @find-services="goTo('home')" @browse-services="goTo('home')" @view-tracking="goTo('tracking')" />
        <ServiceGrid :services="services" @request-service="openRequest" />
      </template>

      <HowItWorksPage v-else-if="currentPage === 'how'" />
      <SignInPage v-else-if="currentPage === 'signin'" @sign-in="signIn" @go-register="goTo('register')" />
      <RegisterPage v-else-if="currentPage === 'register'" @create-account="createAccount" @google-create-account="createAccount" @go-signin="goTo('signin')" />
      <ProviderRegisterPage v-else-if="currentPage === 'provider-register'" @created="createProvider" @google-create="createProvider" @go="goTo" />
      <RequestForm v-else-if="currentPage === 'request'" :service="selectedService" :customer="signedInUser" @submit-request="submitRequest" @back="goTo('home')" />

      <CustomerDashboard v-else-if="currentPage === 'dashboard' && signedInUser?.role === 'customer'" :customer="signedInUser" :requests="requests" @request-another="goTo('home')" @view-tracking="goTo('tracking')" />

      <ProviderDashboard
        v-else-if="currentPage === 'dashboard' && signedInUser?.role === 'provider'"
        :current-user="signedInUser"
        :requests="requests"
        :chat-approvals="chatApprovals"
        :messages="messages"
        :theme="theme"
        :provider-services="providerServices"
        :available-services="services"
        :reviews="providerReviews"
        @toggle-theme="toggleTheme"
        @sign-out="signOut"
        @go-home="goTo('home')"
        @accept-request="acceptProviderRequest"
        @decline-request="declineProviderRequest"
        @status-change="changeRequestStatus"
        @request-chat="requestChat"
        @send-message="sendMessage"
        @block-request="createBlockRequest"
        @add-service="addProviderServiceOffering"
        @toggle-service="toggleProviderService"
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
        @activate-provider="activateProvider"
        @block-customer="blockCustomer"
        @activate-customer="activateCustomer"
        @assign-request="assignRequest"
        @approve-chat="approveChat"
        @reject-chat="rejectChat"
        @block-status-change="updateBlockRequest"
        @reset-db="resetLocalDemo"
      />

      <TrackingDemo v-else-if="currentPage === 'tracking'" :requests="requests" :signed-in-user="signedInUser" @back="goTo(signedInUser ? 'dashboard' : 'home')" />
    </main>

    <AIChatbot
      v-if="!isOpsDashboard"
      :signed-in-user="signedInUser"
      :requests="requests"
      :services="services"
      :current-page="currentPage"
      @navigate="goTo"
    />

    <FooterSection v-if="!isOpsDashboard" />
  </div>
</template>
