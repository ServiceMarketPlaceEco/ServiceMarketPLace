<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
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
import AIChatbot from './components/AI/AIChatbot.vue'
import LandingHighlights from './components/User/LandingHighlights.vue'
import ReviewsPage from './components/User/ReviewsPage.vue'

// Backend service icons can be converted to readable category labels when a
// separate category field is not returned.
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

// The current user and theme are cached only for browser-session continuity.
const savedUser = JSON.parse(localStorage.getItem('servicehub-user') || 'null')

const currentPage = ref(savedUser ? 'dashboard' : 'home')
const theme = ref(localStorage.getItem('servicehub-theme') || 'light')
const signedInUser = ref(savedUser)
const selectedService = ref(null)
const services = ref([])
const requests = ref([])
const accounts = ref([])
const chatApprovals = ref([])
const messages = ref([])
const blockRequests = ref([])
const reviews = ref([])
const appMain = ref(null)
const providerServices = ref([])
const providerReviews = ref([])

// Customer phone verification state. The pending registration is kept only in
// memory until the code is confirmed, so its password is never stored locally.
const showCustomerVerification = ref(false)
const pendingCustomerRegistration = ref(null)
const customerVerificationRequestId = ref('')
const customerVerificationInput = ref('')
const customerVerificationError = ref('')
const customerVerificationBusy = ref(false)
const customerResendSeconds = ref(30)
let customerResendInterval = null

const maskedVerificationPhone = computed(() => {
  const phone = String(pendingCustomerRegistration.value?.phone || '')
  if (phone.length <= 4) return phone
  return `${phone.slice(0, 3)}${'•'.repeat(Math.max(phone.length - 6, 3))}${phone.slice(-3)}`
})

function clearCustomerResendTimer() {
  if (customerResendInterval) window.clearInterval(customerResendInterval)
  customerResendInterval = null
}

function startCustomerResendTimer() {
  clearCustomerResendTimer()
  customerResendSeconds.value = 30
  customerResendInterval = window.setInterval(() => {
    if (customerResendSeconds.value <= 1) {
      customerResendSeconds.value = 0
      clearCustomerResendTimer()
    } else {
      customerResendSeconds.value -= 1
    }
  }, 1000)
}

async function sendCustomerVerificationCode(user) {
  customerVerificationBusy.value = true
  customerVerificationError.value = ''

  try {
    // The backend creates the code, sends the SMS and returns an opaque request ID.
    const result = await api.requestCustomerPhoneVerification({ phone: user.phone })
    customerVerificationRequestId.value = result.verificationId
    pendingCustomerRegistration.value = { ...user }
    customerVerificationInput.value = ''
    showCustomerVerification.value = true
    startCustomerResendTimer()
  } catch (err) {
    alert(err.message || 'We could not send a confirmation code. Please try again.')
  } finally {
    customerVerificationBusy.value = false
  }
}

async function resendCustomerVerificationCode() {
  if (customerResendSeconds.value > 0) return
  const user = pendingCustomerRegistration.value
  if (!user) return

  customerVerificationBusy.value = true
  customerVerificationError.value = ''
  try {
    const result = await api.requestCustomerPhoneVerification({ phone: user.phone })
    customerVerificationRequestId.value = result.verificationId
    customerVerificationInput.value = ''
    startCustomerResendTimer()
  } catch (err) {
    customerVerificationError.value = err.message || 'We could not resend the code.'
  } finally {
    customerVerificationBusy.value = false
  }
}

function updateCustomerVerificationInput(event) {
  customerVerificationInput.value = event.target.value.replace(/\D/g, '').slice(0, 6)
}

function cancelCustomerVerification() {
  clearCustomerResendTimer()
  showCustomerVerification.value = false
  pendingCustomerRegistration.value = null
  customerVerificationRequestId.value = ''
  customerVerificationInput.value = ''
  customerVerificationError.value = ''
  customerVerificationBusy.value = false
}

// Provider applications require admin approval, so a successful registration
// shows a confirmation rather than signing the applicant into a dashboard.
const showProviderRegistrationSuccess = ref(false)
const providerRedirectSeconds = ref(20)
let providerRedirectInterval = null
let providerRedirectTimeout = null

function clearProviderRedirectTimers() {
  if (providerRedirectInterval) window.clearInterval(providerRedirectInterval)
  if (providerRedirectTimeout) window.clearTimeout(providerRedirectTimeout)
  providerRedirectInterval = null
  providerRedirectTimeout = null
}

function returnToLandingPage() {
  clearProviderRedirectTimers()
  showProviderRegistrationSuccess.value = false
  goTo('home')
}

function showProviderSuccessMessage() {
  clearProviderRedirectTimers()
  providerRedirectSeconds.value = 20
  showProviderRegistrationSuccess.value = true

  providerRedirectInterval = window.setInterval(() => {
    if (providerRedirectSeconds.value > 0) providerRedirectSeconds.value -= 1
  }, 1000)

  providerRedirectTimeout = window.setTimeout(returnToLandingPage, 20000)
}

onBeforeUnmount(() => {
  clearProviderRedirectTimers()
  clearCustomerResendTimer()
})

document.documentElement.dataset.theme = theme.value

watch(theme, value => {
  document.documentElement.dataset.theme = value
  localStorage.setItem('servicehub-theme', value)
})
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
  // Prevent a click event or undefined value from becoming the page name.
  if (typeof page !== 'string') {
    console.warn('Invalid navigation value:', page)
    currentPage.value = 'home'
    return
  }

  // Normalise different spellings into one page key.
  const normalisedPage = page
    .trim()
    .toLowerCase()
    .replaceAll('_', '-')

  const pageAliases = {
    'sign-in': 'signin',
    signinpage: 'signin',
    login: 'signin',
    signup: 'register',
    'sign-up': 'register'
  }

  const targetPage = pageAliases[normalisedPage] || normalisedPage

  const validPages = [
    'home',
    'how',
    'reviews',
    'signin',
    'register',
    'provider-register',
    'services',
    'request',
    'dashboard',
    'tracking'
  ]

  if (!validPages.includes(targetPage)) {
    console.warn('Unknown ServiceHub page:', targetPage)
    currentPage.value = 'home'
    return
  }

  if (
    targetPage === 'services' &&
    signedInUser.value?.role !== 'customer'
  ) {
    currentPage.value = 'signin'
    return
  }

  currentPage.value = targetPage
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
    services.value = await Promise.all(catalog.map(async service => {
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
        category: service.category || ICON_CATEGORY_MAP[service.icon] || 'General',
        price: bestOffer?.price ?? 0,
        currency: service.currency || 'BDT',
        image: service.imageUrl || service.image || '',
        description: service.description || '',
        upfrontPayment: service.upfrontPayment || null
      }
    }))
  } catch (err) {
    console.warn('Could not load services catalog:', err.message)
  }
}

async function loadPublicReviews() {
  try {
    const raw = await api.getPublicReviews()
    reviews.value = raw.map(review => ({
      id: review.reviewId || review.id,
      name: review.username || review.name || review.customer?.name || 'ServiceHub user',
      role: review.userType || review.role || 'guest',
      serviceId: review.serviceId,
      serviceTitle: review.serviceTitle || review.service?.serviceName || 'Service',
      rating: Number(review.rating || 0),
      comment: review.comment || '',
      createdAt: review.createdAt
    }))
  } catch (err) {
    console.warn('Could not load reviews:', err.message)
    reviews.value = []
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
    customerPhone: booking.customer?.phone || '',
    providerId: providerService?.providerId || '',
    providerServiceId: booking.providerServiceId,
    providerName: providerService?.provider?.providerName || '',
    providerPhone: providerService?.provider?.phone || '',
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

async function refreshChatData() {
  if (!signedInUser.value) {
    chatApprovals.value = []
    messages.value = []
    return
  }

  try {
    const [approvals, chatMessages] = await Promise.all([
      api.getChatApprovals(),
      api.getChatMessages()
    ])
    chatApprovals.value = approvals
    messages.value = chatMessages
  } catch (err) {
    console.warn('Could not load chat data:', err.message)
  }
}

async function applySession(res, userType) {
  api.setTokens(res.accessToken, res.refreshToken)
  signedInUser.value = normalizeUser(res.user, userType)
  currentPage.value = 'dashboard'
  await Promise.all([refreshBookings(), refreshChatData()])
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
  await Promise.all([loadServices(), loadPublicReviews()])
  if (signedInUser.value) {
    await Promise.all([refreshBookings(), refreshChatData()])
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
  if (user.accountMethod === 'google') {
    api.beginGoogleSignIn('register')
    return
  }

  // The actual account is created only after the phone number is verified.
  await sendCustomerVerificationCode(user)
}

async function verifyAndCreateCustomer() {
  customerVerificationError.value = ''

  if (customerVerificationInput.value.length !== 6) {
    customerVerificationError.value = 'Enter the complete six-digit confirmation code.'
    return
  }

  const user = pendingCustomerRegistration.value
  if (!user || !customerVerificationRequestId.value) {
    customerVerificationError.value = 'The registration session has expired. Please submit the form again.'
    return
  }

  customerVerificationBusy.value = true
  try {
    const email = clean(user.email) || `${clean(user.name).toLowerCase().replace(/\s+/g, '.')}@servicehub.local`

    // The backend validates the SMS code and returns a short-lived token.
    const verification = await api.verifyCustomerPhoneCode({
      verificationId: customerVerificationRequestId.value,
      phone: user.phone,
      code: customerVerificationInput.value
    })

    // Account creation is authorised only by the server-issued verification token.
    const res = await api.registerCustomer({
      name: user.name,
      username: user.username,
      email,
      password: user.password || undefined,
      phone: user.phone,
      address: user.location,
      phoneVerificationToken: verification.verificationToken,
      authProvider: user.accountMethod || 'phone'
    })
    await applySession(res, 'customer')

    cancelCustomerVerification()
  } catch (err) {
    customerVerificationError.value = err.message || 'Account registration failed.'
  } finally {
    customerVerificationBusy.value = false
  }
}

async function createProvider(provider) {
  try {
    if (provider.authProvider === 'google') {
      api.beginGoogleSignIn('provider-register')
      return
    }

    const email = clean(provider.email) || `${clean(provider.name).toLowerCase().replace(/\s+/g, '.')}@servicehub.local`

    await api.registerProvider({
      providerName: provider.name || 'Google Provider',
      username: provider.username,
      email,
      password: provider.password || undefined,
      phone: digitsOnly(provider.phone),
      address: provider.suburb || provider.area || 'Rajshahi City',
      serviceType: provider.serviceType,
      description: provider.experience || undefined,
      authProvider: provider.authProvider || 'email'
    })

    // Do not create an authenticated provider session before admin approval.
    showProviderSuccessMessage()
  } catch (err) {
    alert(err.message || 'Provider registration failed.')
  }
}

async function signIn(payload) {
  if (payload.authProvider === 'google') {
    api.beginGoogleSignIn('signin')
    return
  }

  const identifier = clean(payload.identifier || payload.email)

  if (!identifier) {
    alert('Enter your username, phone number or email.')
    return
  }

  // Temporary fallback until the backend returns the role directly from the
  // identifier. Provider usernames begin with PR and admin IDs begin with ADM.
  const normalizedIdentifier = identifier.toLowerCase()
  const inferredRole = normalizedIdentifier.startsWith('pr')
    ? 'provider'
    : normalizedIdentifier.startsWith('adm') || normalizedIdentifier.startsWith('admin')
      ? 'admin'
      : 'customer'

  try {
    if (payload.password) {
      const res = await api.login({
        email: identifier,
        password: payload.password,
        userType: inferredRole
      })
      await applySession(res, res.user?.role || res.userType || inferredRole)
      return
    }

    // No local Google user is created. The backend owns the OAuth exchange.
    api.beginGoogleSignIn()
  } catch (err) {
    alert(err.message || 'Sign in failed.')
  }
}

async function requestPasswordReset({ email }) {
  try {
    // Temporary customer fallback while the API still expects userType.
    await api.forgotPassword(email, 'customer')
    alert('If an account exists with this email, a password reset link has been sent.')
  } catch (err) {
    alert(err.message || 'Could not request password reset.')
  }
}

async function confirmPasswordReset({ token, newPassword }) {
  try {
    await api.resetPassword(token, newPassword)
    alert('Password reset successfully. You can now sign in with your new password.')
  } catch (err) {
    alert(err.message || 'Could not reset password. The token may be invalid or expired.')
  }
}

// ---------- Bookings ----------

function openRequest(service) {
  // Only customers can progress from service discovery to a booking request.
  if (signedInUser.value?.role !== 'customer') {
    currentPage.value = 'signin'
    return
  }

  selectedService.value = service
  currentPage.value = 'request'
}

async function submitReview(review) {
  try {
    await api.createReview({
      username: review.name || signedInUser.value?.name,
      userType: review.role || signedInUser.value?.role || 'guest',
      serviceId: review.serviceId,
      rating: Number(review.rating),
      comment: review.comment
    })
    await loadPublicReviews()
  } catch (err) {
    alert(err.message || 'Could not submit review.')
  }
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
async function assignRequest({ requestId, providerId }) {
  try {
    await api.updateBookingStatusPublic(requestId, 'confirmed', providerId)
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
async function updateProviderProfile(payload) {
  try {
    const res = await api.updateProviderProfile({
      providerName: payload.providerName,
      address: payload.address,
      phone: digitsOnly(payload.phone),
      description: payload.description
    })
    signedInUser.value = normalizeUser(res, 'provider')
    alert('Profile updated.')
  } catch (err) {
    alert(err.message || 'Could not update profile.')
  }
}
async function changeProviderPassword(payload) {
  try {
    await api.changeProviderPassword(payload)
    alert('Password updated.')
  } catch (err) {
    alert(err.message || 'Could not update password.')
  }
}

// ---------- Chat ----------

async function requestChat(payload) {
  try {
    await api.requestChatApproval(payload)
    await refreshChatData()
  } catch (err) {
    alert(err.message || 'Could not request chat approval.')
  }
}
async function approveChat(id) {
  try {
    await api.updateChatApproval(id, 'approved')
    await refreshChatData()
  } catch (err) {
    alert(err.message || 'Could not approve chat access.')
  }
}
async function rejectChat(id) {
  try {
    await api.updateChatApproval(id, 'rejected')
    await refreshChatData()
  } catch (err) {
    alert(err.message || 'Could not reject chat access.')
  }
}
async function sendMessage(payload) {
  try {
    await api.sendChatMessage(payload)
    await refreshChatData()
  } catch (err) {
    alert(err.message || 'Could not send message.')
  }
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

async function refreshAdminData() {
  await Promise.all([
    refreshAdminAccounts(),
    refreshAdminReports(),
    refreshBookings(),
    refreshChatData()
  ])
}
</script>

<template>
  <div class="app-shell">
    <NavBar v-if="!isOpsDashboard" :active-page="currentPage" :signed-in-user="signedInUser" :theme="theme"
      @navigate="goTo" @sign-out="signOut" @toggle-theme="toggleTheme" />

    <main ref="appMain" class="app-main" tabindex="-1">
      <template v-if="currentPage === 'home'">
        <HeroSection @get-started="goTo('register')" @view-tracking="goTo('tracking')" />
        <LandingHighlights :reviews="reviews" @become-provider="goTo('provider-register')" />
      </template>

      <!-- ServiceGrid and VoiceSearch are available only to signed-in customers. -->
      <ServiceGrid v-else-if="currentPage === 'services' && signedInUser?.role === 'customer'" :services="services"
        @request-service="openRequest" />

      <HowItWorksPage v-else-if="currentPage === 'how'" />
      <ReviewsPage v-else-if="currentPage === 'reviews'" :reviews="reviews" :services="services"
        :signed-in-user="signedInUser" @submit-review="submitReview" />
      <SignInPage v-else-if="currentPage === 'signin'" @sign-in="signIn" @go-register="goTo('register')"
        @forgot-password="requestPasswordReset" @reset-password="confirmPasswordReset" />
      <RegisterPage v-else-if="currentPage === 'register'" @create-account="createAccount"
        @google-create-account="createAccount" @go-signin="goTo('signin')" />
      <ProviderRegisterPage v-else-if="currentPage === 'provider-register'" @created="createProvider"
        @google-create="createProvider" @go="goTo" />
      <RequestForm v-else-if="currentPage === 'request'" :service="selectedService" :customer="signedInUser"
        @submit-request="submitRequest" @back="goTo('services')" />

      <CustomerDashboard v-else-if="currentPage === 'dashboard' && signedInUser?.role === 'customer'"
        :customer="signedInUser" :requests="requests" @request-another="goTo('services')"
        @view-tracking="goTo('tracking')" />

      <ProviderDashboard v-else-if="currentPage === 'dashboard' && signedInUser?.role === 'provider'"
        :current-user="signedInUser" :requests="requests" :chat-approvals="chatApprovals" :messages="messages"
        :theme="theme" :provider-services="providerServices" :available-services="services" :reviews="providerReviews"
        @toggle-theme="toggleTheme" @sign-out="signOut" @go-home="goTo('home')" @accept-request="acceptProviderRequest"
        @decline-request="declineProviderRequest" @status-change="changeRequestStatus" @request-chat="requestChat"
        @send-message="sendMessage" @block-request="createBlockRequest" @add-service="addProviderServiceOffering"
        @toggle-service="toggleProviderService" @update-profile="updateProviderProfile"
        @change-password="changeProviderPassword" />

      <AdminDashboard v-else-if="currentPage === 'dashboard' && signedInUser?.role === 'admin'" :accounts="accounts"
        :requests="requests" :chat-approvals="chatApprovals" :block-requests="blockRequests" :theme="theme"
        @toggle-theme="toggleTheme" @sign-out="signOut" @go-home="goTo('home')" @approve-provider="approveProvider"
        @reject-provider="rejectProvider" @activate-provider="activateProvider" @block-customer="blockCustomer"
        @activate-customer="activateCustomer" @assign-request="assignRequest" @approve-chat="approveChat"
        @reject-chat="rejectChat" @block-status-change="updateBlockRequest" @reset-db="refreshAdminData" />

      <TrackingDemo v-else-if="currentPage === 'tracking'" :requests="requests" :signed-in-user="signedInUser"
        @back="goTo(signedInUser ? 'dashboard' : 'home')" />

      <section v-else class="page-section">
        <div class="clean-card">
          <h1>Page unavailable</h1>
          <p>An invalid navigation destination was received.</p>

          <button class="primary" type="button" @click="goTo('home')">
            Return home
          </button>
        </div>
      </section>
    </main>

    <!-- Customer phone identity verification -->
    <Teleport to="body">
      <div v-if="showCustomerVerification" class="account-modal-backdrop" role="presentation">
        <section class="account-modal-dialog customer-verification-dialog" role="dialog" aria-modal="true"
          aria-labelledby="customer-verification-title" aria-describedby="customer-verification-description">
          <div class="account-modal-icon phone-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path
                d="M7 2.75h10A2.25 2.25 0 0 1 19.25 5v14A2.25 2.25 0 0 1 17 21.25H7A2.25 2.25 0 0 1 4.75 19V5A2.25 2.25 0 0 1 7 2.75Zm0 1.5a.75.75 0 0 0-.75.75v14c0 .414.336.75.75.75h10a.75.75 0 0 0 .75-.75V5a.75.75 0 0 0-.75-.75H7ZM10 17.5h4a.75.75 0 0 1 0 1.5h-4a.75.75 0 0 1 0-1.5Z" />
            </svg>
          </div>

          <p class="eyebrow">Verify your identity</p>
          <h2 id="customer-verification-title">Check your phone</h2>
          <p id="customer-verification-description" class="account-modal-message">
            We sent a six-digit confirmation code to
            <strong>{{ maskedVerificationPhone }}</strong>. Enter it below to finish creating your account.
          </p>

          <form class="verification-form" @submit.prevent="verifyAndCreateCustomer">
            <label for="customer-verification-code">Confirmation code</label>
            <input id="customer-verification-code" :value="customerVerificationInput" type="text" inputmode="numeric"
              autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" placeholder="000000" autofocus
              aria-describedby="verification-help" @input="updateCustomerVerificationInput" />
            <small id="verification-help">Enter the six numbers from the SMS message.</small>

            <p v-if="customerVerificationError" class="verification-error" role="alert">
              {{ customerVerificationError }}
            </p>

            <button class="primary" type="submit"
              :disabled="customerVerificationInput.length !== 6 || customerVerificationBusy">
              {{ customerVerificationBusy ? 'Verifying…' : 'Verify and create account' }}
            </button>
          </form>

          <div class="verification-actions">
            <button class="verification-link" type="button"
              :disabled="customerResendSeconds > 0 || customerVerificationBusy" @click="resendCustomerVerificationCode">
              {{ customerResendSeconds > 0
                ? `Resend code in ${customerResendSeconds}s`
                : 'Resend confirmation code' }}
            </button>
            <button class="verification-link muted-link" type="button" :disabled="customerVerificationBusy"
              @click="cancelCustomerVerification">
              Cancel registration
            </button>
          </div>
        </section>
      </div>
    </Teleport>

    <!-- Accessible confirmation dialog shown after a provider application is sent -->
    <Teleport to="body">
      <div v-if="showProviderRegistrationSuccess" class="provider-success-backdrop" role="presentation">
        <section class="provider-success-dialog" role="dialog" aria-modal="true"
          aria-labelledby="provider-success-title"
          aria-describedby="provider-success-description provider-success-countdown">
          <div class="provider-success-icon" aria-hidden="true">✓</div>
          <p class="eyebrow">Application submitted</p>
          <h2 id="provider-success-title">Thanks for signing up!</h2>
          <p id="provider-success-description" class="provider-success-message">
            We’ll let the admins know, and we’ll let you know if you’re eligible to become a ServiceHub provider.
          </p>

          <div class="provider-success-status" role="status" aria-live="polite">
            <span class="provider-success-spinner" aria-hidden="true"></span>
            <p id="provider-success-countdown">
              Returning to the landing page in
              <strong>{{ providerRedirectSeconds }} seconds</strong>
            </p>
          </div>

          <button class="primary" type="button" autofocus @click="returnToLandingPage">
            Return to landing page now
          </button>
        </section>
      </div>
    </Teleport>

    <!-- The assistant stays available on public pages and every dashboard. -->
    <AIChatbot :signed-in-user="signedInUser" :requests="requests" :services="services" :current-page="currentPage"
      @navigate="goTo" />

    <FooterSection v-if="!isOpsDashboard" />
  </div>
</template>

<!-- Kept inside App.vue so the confirmation remains a real modal even when
     an older global stylesheet is still present in the local project -->
<style scoped>
.account-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: grid;
  place-items: center;
  width: 100vw;
  min-height: 100vh;
  padding: 24px;
  overflow-y: auto;
  background: rgba(18, 8, 39, 0.76);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.account-modal-dialog {
  width: min(540px, 100%);
  display: grid;
  justify-items: center;
  gap: 17px;
  border: 1px solid var(--line, #ded0ff);
  border-radius: var(--radius-xl, 30px);
  padding: clamp(28px, 6vw, 46px);
  background: var(--surface, #fff);
  color: var(--text, #1f1537);
  box-shadow: 0 32px 90px rgba(18, 8, 39, 0.36);
  text-align: center;
  animation: provider-dialog-enter 0.24s ease-out;
}

.account-modal-icon {
  width: 72px;
  height: 72px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: #fff;
  background: linear-gradient(135deg, var(--brand, #7437f4), var(--brand-2, #5a25cf));
  box-shadow: 0 16px 34px rgba(116, 55, 244, 0.28);
}

.account-modal-icon svg {
  width: 36px;
  height: 36px;
  fill: currentColor;
}

.account-modal-dialog .eyebrow {
  margin: 2px 0 -7px;
  color: var(--brand-2, #5a25cf);
  font-size: 0.78rem;
  font-weight: 950;
  letter-spacing: 0.15em;
  text-transform: uppercase;
}

.account-modal-dialog h2 {
  margin: 0;
  color: var(--heading, #160d2e);
  font-size: clamp(2rem, 5vw, 3rem);
  line-height: 1.05;
}

.account-modal-message {
  max-width: 45ch;
  margin: 0;
  color: var(--muted, #655b7c);
  font-size: 1.04rem;
  line-height: 1.6;
}

.account-modal-message strong {
  color: var(--heading, #160d2e);
  white-space: nowrap;
}

.verification-form {
  width: 100%;
  display: grid;
  gap: 10px;
  text-align: left;
}

.verification-form label {
  color: var(--heading, #160d2e);
  font-weight: 850;
}

.verification-form input {
  width: 100%;
  min-height: 58px;
  border: 1.5px solid var(--line-strong, #c5afff);
  border-radius: var(--radius-md, 16px);
  padding: 10px 16px;
  background: var(--surface, #fff);
  color: var(--heading, #160d2e);
  font: inherit;
  font-size: 1.5rem;
  font-weight: 900;
  letter-spacing: 0.28em;
  text-align: center;
}

.verification-form input::placeholder {
  color: var(--muted-2, #8d84a1);
  opacity: 0.65;
}

.verification-form input:focus {
  border-color: var(--brand, #7437f4);
  outline: none;
  box-shadow: 0 0 0 4px rgba(116, 55, 244, 0.16);
}

.verification-form small {
  color: var(--muted, #655b7c);
  text-align: center;
}

.verification-error {
  margin: 4px 0;
  color: var(--danger, #c92a2a);
  font-weight: 800;
  text-align: center;
}

.verification-form .primary {
  width: 100%;
  margin-top: 6px;
}

.verification-form .primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.verification-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px 18px;
}

.verification-link {
  border: 0;
  padding: 5px;
  background: transparent;
  color: var(--brand-2, #5a25cf);
  font: inherit;
  font-weight: 850;
  cursor: pointer;
}

.verification-link:disabled {
  color: var(--muted-2, #8d84a1);
  cursor: not-allowed;
}

.verification-link.muted-link {
  color: var(--muted, #655b7c);
}

.provider-success-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: grid;
  place-items: center;
  width: 100vw;
  min-height: 100vh;
  padding: 24px;
  overflow-y: auto;
  background: rgba(18, 8, 39, 0.76);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.provider-success-dialog {
  width: min(560px, 100%);
  display: grid;
  justify-items: center;
  gap: 18px;
  border: 1px solid var(--line, #ded0ff);
  border-radius: var(--radius-xl, 30px);
  padding: clamp(28px, 6vw, 48px);
  background: var(--surface, #fff);
  color: var(--text, #1f1537);
  box-shadow: 0 32px 90px rgba(18, 8, 39, 0.34);
  text-align: center;
  animation: provider-dialog-enter 0.24s ease-out;
}

.provider-success-icon {
  width: 72px;
  height: 72px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: #fff;
  background: linear-gradient(135deg, #087f5b, #16a878);
  box-shadow: 0 16px 34px rgba(8, 127, 91, 0.24);
  font-size: 2rem;
  font-weight: 950;
}

.provider-success-dialog .eyebrow {
  margin: 2px 0 -6px;
  color: var(--brand-2, #5a25cf);
  font-size: 0.78rem;
  font-weight: 950;
  letter-spacing: 0.15em;
  text-transform: uppercase;
}

.provider-success-dialog h2 {
  margin: 0;
  color: var(--heading, #160d2e);
  font-size: clamp(2rem, 5vw, 3rem);
  line-height: 1.05;
}

.provider-success-message {
  max-width: 46ch;
  margin: 0;
  color: var(--muted, #655b7c);
  font-size: 1.06rem;
  line-height: 1.6;
}

.provider-success-status {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  border: 1px solid var(--line, #ded0ff);
  border-radius: var(--radius-md, 16px);
  padding: 14px 16px;
  background: var(--surface-2, #faf7ff);
  color: var(--muted, #655b7c);
}

.provider-success-status p {
  margin: 0;
}

.provider-success-status strong {
  color: var(--brand-2, #5a25cf);
}

.provider-success-spinner {
  width: 20px;
  height: 20px;
  flex: 0 0 auto;
  border: 3px solid var(--line-strong, #c5afff);
  border-top-color: var(--brand, #7437f4);
  border-radius: 50%;
  animation: provider-spinner 1s linear infinite;
}

.provider-success-dialog .primary {
  width: 100%;
  min-height: 48px;
  border: 1px solid transparent;
  border-radius: 14px;
  padding: 11px 20px;
  color: #fff;
  background: linear-gradient(135deg, var(--brand, #7437f4), var(--brand-2, #5a25cf));
  box-shadow: 0 14px 30px rgba(116, 55, 244, 0.24);
  font: inherit;
  font-weight: 900;
  cursor: pointer;
}

.provider-success-dialog .primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 18px 36px rgba(116, 55, 244, 0.32);
}

.provider-success-dialog .primary:focus-visible {
  outline: 3px solid rgba(160, 124, 255, 0.45);
  outline-offset: 4px;
}

@keyframes provider-dialog-enter {
  from {
    opacity: 0;
    transform: translateY(16px) scale(0.97);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes provider-spinner {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 520px) {

  .account-modal-backdrop,
  .provider-success-backdrop {
    padding: 16px;
  }

  .account-modal-dialog,
  .provider-success-dialog {
    gap: 15px;
    border-radius: 22px;
    padding: 26px 20px;
  }

  .provider-success-status {
    align-items: flex-start;
    text-align: left;
  }
}

@media (prefers-reduced-motion: reduce) {

  .account-modal-dialog,
  .provider-success-dialog,
  .provider-success-spinner {
    animation: none;
  }
}
</style>
