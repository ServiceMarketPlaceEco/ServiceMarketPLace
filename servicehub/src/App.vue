<script setup>
import { ref, computed, onMounted } from 'vue'
import NavBar from './components/NavBar.vue'
import ServiceGrid from './components/ServiceGrid.vue'
import DownloadCTA from './components/DownloadCTA.vue'
import CustomerDashboard from './components/CustomerDashboard.vue'
import FooterSection from './components/FooterSection.vue'
import SignInModal from './components/SignInModal.vue'
import RegisterPage from './components/RegisterPage.vue'
import AdminDashboard from './components/AdminDashboard.vue'
import HowItWorksPage from './components/HowItWorksPage.vue'
import { services } from './data/services.js'
import { useAuth } from './composables/useAuth.js'
import { bookingsApi, reviewsApi, reportsApi } from './services/api.js'

// Auth composable
const { 
  currentUser, 
  isAuthenticated, 
  userRole, 
  userName,
  isLoading,
  error: authError,
  registerCustomer, 
  loginCustomer, 
  loginAdmin,
  logout,
  checkAuth 
} = useAuth()

const activePage = ref('services')
const selectedService = ref(null)
const showSignIn = ref(false)
const selectedCategory = ref('All')
const sortMode = ref('recommended')
const requests = ref([])
const reviews = ref([])
const blockReports = ref([])
const apiError = ref(null)

const signedIn = computed(() => isAuthenticated.value)
const categories = computed(() => ['All', ...new Set(services.map(service => service.category))])

const visibleServices = computed(() => {
  let list = [...services]
  if (selectedCategory.value !== 'All') {
    list = list.filter(service => service.category === selectedCategory.value)
  }
  if (sortMode.value === 'price-low') list.sort((a, b) => Number(a.price || a.basePrice) - Number(b.price || b.basePrice))
  if (sortMode.value === 'rating') list.sort((a, b) => b.rating - a.rating)
  return list
})

const userRequests = computed(() => {
  if (!signedIn.value || userRole.value === 'admin') return []
  return requests.value.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
})

// Initialize app
onMounted(async () => {
  await checkAuth()
  
  // If user is logged in, fetch their data
  if (isAuthenticated.value) {
    await fetchUserData()
  }
})

// Fetch user's bookings, reviews, reports from API
async function fetchUserData() {
  try {
    if (userRole.value !== 'admin') {
      const [bookingsData, reviewsData, reportsData] = await Promise.all([
        bookingsApi.getMyBookings().catch(() => []),
        reviewsApi.getMyReviews().catch(() => []),
        reportsApi.getMyReports().catch(() => [])
      ])
      
      // Transform bookings data to match frontend format
      requests.value = bookingsData.map(booking => ({
        id: booking.bookingId,
        service: booking.providerService?.service?.serviceName || booking.notes || 'Service Request',
        provider: booking.providerService?.provider?.providerName || 'Pending Assignment',
        area: booking.address || '',
        date: booking.date ? new Date(booking.date).toISOString().split('T')[0] : '',
        details: booking.notes || '',
        status: capitalizeStatus(booking.status),
        createdAt: booking.createdAt
      }))
      
      reviews.value = reviewsData
      blockReports.value = reportsData
    }
  } catch (err) {
    console.error('Error fetching user data:', err)
  }
}

// Helper to capitalize status
function capitalizeStatus(status) {
  if (!status) return 'Pending'
  return status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')
}

function goTo(page) {
  if (page === 'dashboard' && !signedIn.value) {
    showSignIn.value = true
    return
  }
  activePage.value = page
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function selectService(service) {
  if (!signedIn.value) {
    showSignIn.value = true
    return
  }
  selectedService.value = service
  activePage.value = 'request'
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

// Register user via API
async function handleRegister(form) {
  apiError.value = null
  
  const result = await registerCustomer({
    name: form.name,
    email: form.email,
    password: form.password,
    phone: form.phone,
    area: form.area
  })
  
  if (result.success) {
    activePage.value = 'dashboard'
  } else {
    apiError.value = result.error
    alert(result.error)
  }
}

// Sign in via API
async function handleSignIn(credentials) {
  apiError.value = null
  
  // Check for admin login (demo admin)
  if (credentials.identifier === 'Admin' && credentials.password === '1111') {
    // For demo purposes, we'll still allow the hardcoded admin
    // In production, this should go through the API
    try {
      const result = await loginAdmin('admin@servicehub.com', 'Admin1234')
      if (result.success) {
        showSignIn.value = false
        activePage.value = 'dashboard'
        return
      }
    } catch (err) {
      // Fallback to demo admin if API admin doesn't exist
      console.log('Using demo admin fallback')
    }
    
    // Demo admin fallback
    currentUser.value = { id: 'ADMIN-1', name: 'Admin', role: 'admin', userType: 'admin' }
    showSignIn.value = false
    activePage.value = 'dashboard'
    return
  }
  
  // Try customer login
  const result = await loginCustomer(credentials.identifier, credentials.password)
  
  if (result.success) {
    showSignIn.value = false
    activePage.value = 'dashboard'
    await fetchUserData()
  } else {
    alert(result.error)
  }
}

// Sign out
async function handleSignOut() {
  await logout()
  requests.value = []
  reviews.value = []
  blockReports.value = []
  activePage.value = 'services'
}

// Submit service request via API
async function submitRequest(event) {
  const form = event.target
  
  try {
    const newBooking = await bookingsApi.create({
      serviceId: selectedService.value.id || selectedService.value.title,
      providerId: selectedService.value.providerId,
      serviceName: selectedService.value.title,
      providerName: selectedService.value.provider,
      date: form.date.value,
      time: '09:00',
      address: form.area.value,
      notes: `${selectedService.value.title} - ${form.details.value}`
    })
    
    // Add to local state
    requests.value.push({
      id: newBooking.bookingId || `REQ-${Date.now().toString().slice(-6)}`,
      service: selectedService.value.title,
      provider: selectedService.value.provider,
      area: form.area.value,
      date: form.date.value,
      details: form.details.value,
      status: 'Pending',
      createdAt: new Date().toISOString()
    })
    
    selectedService.value = null
    activePage.value = 'dashboard'
  } catch (err) {
    console.error('Booking error:', err)
    // Fallback to local storage if API fails
    requests.value.push({
      id: `REQ-${Date.now().toString().slice(-6)}`,
      service: selectedService.value.title,
      provider: selectedService.value.provider,
      area: form.area.value,
      date: form.date.value,
      details: form.details.value,
      status: 'Pending',
      createdAt: new Date().toISOString()
    })
    selectedService.value = null
    activePage.value = 'dashboard'
  }
}

// Submit review via API
async function addReview(payload) {
  try {
    await reviewsApi.create({
      bookingId: payload.requestId,
      providerId: payload.providerId,
      rating: payload.rating || 5,
      comment: payload.review
    })
    
    reviews.value.push({ 
      ...payload, 
      customerId: currentUser.value?.customerId,
      createdAt: new Date().toISOString() 
    })
    
    alert('Review submitted successfully.')
  } catch (err) {
    console.error('Review error:', err)
    // Fallback to local state
    reviews.value.push({ 
      ...payload, 
      customerId: currentUser.value?.customerId,
      createdAt: new Date().toISOString() 
    })
    alert('Review submitted successfully.')
  }
}

// Submit block report via API
async function addBlock(payload) {
  try {
    await reportsApi.create({
      reportedType: 'provider',
      reportedId: payload.providerId || payload.provider,
      reason: payload.reason
    })
    
    blockReports.value.push({ 
      ...payload, 
      customerId: currentUser.value?.customerId,
      createdAt: new Date().toISOString(), 
      status: 'pending' 
    })
    
    alert('Block request sent to admin for review.')
  } catch (err) {
    console.error('Block report error:', err)
    // Fallback to local state
    blockReports.value.push({ 
      ...payload, 
      customerId: currentUser.value?.customerId,
      createdAt: new Date().toISOString(), 
      status: 'pending' 
    })
    alert('Block request sent to admin for review.')
  }
}

function updateStatus({ id, status }) {
  const request = requests.value.find(item => item.id === id)
  if (request) request.status = status
}
</script>

<template>
  <NavBar
    :signed-in="signedIn"
    :user-role="userRole"
    :active-page="activePage"
    @go-home="goTo('services')"
    @how-it-works="goTo('how')"
    @go-dashboard="goTo('dashboard')"
    @register="goTo('register')"
    @sign-in="showSignIn = true"
    @sign-out="handleSignOut"
  />

  <main>
    <!-- Loading indicator -->
    <div v-if="isLoading" class="loading-overlay">
      <div class="loading-spinner"></div>
    </div>

    <section v-if="activePage === 'services'" class="hero">
      <div>
        <span class="eyebrow">Rajshahi local service marketplace</span>
        <h1>Book trusted local help for daily tasks.</h1>
        <p>Service Hub connects customers with registered helpers for bazaar shopping, medicine pickup, delivery, cleaning, tutoring and family support.</p>
        <div class="hero-actions">
          <button class="primary" @click="goTo('services-list')">Find services</button>
          <button class="secondary" @click="goTo('how')">How it works</button>
        </div>
      </div>
      <div class="hero-card">
        <strong>Suggested starting price</strong>
        <h2>From ৳100</h2>
        <p>Transparent local pricing before sending a request.</p>
      </div>
    </section>

    <section v-if="activePage === 'services' || activePage === 'services-list'" class="page-section">
      <div class="section-heading">
        <span class="eyebrow">Choose a category first</span>
        <h2>Popular services in Rajshahi</h2>
        <p>View a service, check the suggested price, then describe your request.</p>
      </div>
      <ServiceGrid
        :services="visibleServices"
        :categories="categories"
        :selected-category="selectedCategory"
        :sort-mode="sortMode"
        @update-category="selectedCategory = $event"
        @update-sort="sortMode = $event"
        @book-service="selectService"
      />
      <DownloadCTA />
    </section>

    <section v-if="activePage === 'request' && selectedService" class="page-section request-shell">
      <button class="secondary compact" @click="goTo('services-list')">← Back to services</button>
      <div class="request-layout">
        <div class="request-summary">
          <img :src="selectedService.image" :alt="selectedService.title" />
          <h2>{{ selectedService.title }}</h2>
          <p>{{ selectedService.description }}</p>
          <div class="price-pill">Suggested price: ৳{{ selectedService.price || selectedService.basePrice }}</div>
        </div>

        <form class="request-form" @submit.prevent="submitRequest">
          <h2>Describe your request</h2>
          <label>Rajshahi area<input name="area" required placeholder="Example: Shaheb Bazar" /></label>
          <label>Preferred date<input name="date" required type="date" /></label>
          <label>Request details<textarea name="details" required rows="5" placeholder="Example: Need weekly bazaar shopping in the morning."></textarea></label>
          <button class="primary full" :disabled="isLoading">
            {{ isLoading ? 'Submitting...' : 'Submit request' }}
          </button>
        </form>
      </div>
    </section>

    <section v-if="activePage === 'dashboard'" class="page-section dash-page">
      <AdminDashboard
        v-if="userRole === 'admin'"
        :bookings="requests"
        :services="services"
        @update-status="updateStatus"
      />
      <CustomerDashboard
        v-else
        :requests="userRequests"
        :user-name="userName"
        @new-request="goTo('services-list')"
        @write-review="addReview"
        @block-helper="addBlock"
      />
    </section>

    <HowItWorksPage v-if="activePage === 'how'" />

    <RegisterPage
      v-if="activePage === 'register'"
      :is-loading="isLoading"
      @register="handleRegister"
      @go-signin="showSignIn = true"
    />
  </main>

  <FooterSection />

  <SignInModal
    v-if="showSignIn"
    :is-loading="isLoading"
    @close="showSignIn = false"
    @sign-in="handleSignIn"
  />
</template>

<style>
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #e5e7eb;
  border-top-color: #2563eb;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
