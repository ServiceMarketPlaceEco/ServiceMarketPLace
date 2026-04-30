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

const activePage = ref('services')
const selectedService = ref(null)
const showSignIn = ref(false)
const currentUser = ref(null)
const selectedCategory = ref('All')
const sortMode = ref('recommended')
const users = ref([])
const requests = ref([])
const reviews = ref([])
const blockReports = ref([])

const signedIn = computed(() => Boolean(currentUser.value))
const userRole = computed(() => currentUser.value?.role || 'customer')
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
  return requests.value
    .filter(request => request.userId === currentUser.value.id)
    .sort((a, b) => b.createdAt - a.createdAt)
})

onMounted(() => {
  users.value = JSON.parse(localStorage.getItem('servicehub-users') || '[]')
  requests.value = JSON.parse(localStorage.getItem('servicehub-requests') || '[]')
  reviews.value = JSON.parse(localStorage.getItem('servicehub-reviews') || '[]')
  blockReports.value = JSON.parse(localStorage.getItem('servicehub-blocks') || '[]')
  currentUser.value = JSON.parse(sessionStorage.getItem('servicehub-current-user') || 'null')
})

function persist() {
  localStorage.setItem('servicehub-users', JSON.stringify(users.value))
  localStorage.setItem('servicehub-requests', JSON.stringify(requests.value))
  localStorage.setItem('servicehub-reviews', JSON.stringify(reviews.value))
  localStorage.setItem('servicehub-blocks', JSON.stringify(blockReports.value))
  if (currentUser.value) sessionStorage.setItem('servicehub-current-user', JSON.stringify(currentUser.value))
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

function registerUser(form) {
  const exists = users.value.some(user => user.email.toLowerCase() === form.email.toLowerCase() || user.phone === form.phone)
  if (exists) {
    alert('This email or phone is already registered. Please sign in.')
    showSignIn.value = true
    return
  }
  const newUser = { id: `USR-${Date.now()}`, role: 'customer', ...form }
  users.value.push(newUser)
  currentUser.value = { ...newUser, password: undefined }
  persist()
  activePage.value = 'dashboard'
}

function signIn(credentials) {
  if (credentials.identifier === 'Admin' && credentials.password === '1111') {
    currentUser.value = { id: 'ADMIN-1', name: 'Admin', role: 'admin' }
    persist()
    showSignIn.value = false
    activePage.value = 'dashboard'
    return
  }
  const identifier = credentials.identifier.toLowerCase()
  const user = users.value.find(user => (user.email?.toLowerCase() === identifier || user.phone === credentials.identifier) && user.password === credentials.password)
  if (!user) {
    alert('Sign in failed. This account is not registered or the password is incorrect.')
    return
  }
  currentUser.value = { ...user, password: undefined }
  persist()
  showSignIn.value = false
  activePage.value = 'dashboard'
}

function signOut() {
  currentUser.value = null
  sessionStorage.removeItem('servicehub-current-user')
  activePage.value = 'services'
}

function submitRequest(event) {
  const form = event.target
  requests.value.push({
    id: `REQ-${Date.now().toString().slice(-6)}`,
    userId: currentUser.value.id,
    service: selectedService.value.title,
    provider: selectedService.value.provider,
    area: form.area.value,
    date: form.date.value,
    details: form.details.value,
    status: 'Pending',
    createdAt: Date.now()
  })
  persist()
  selectedService.value = null
  activePage.value = 'dashboard'
}

function addReview(payload) {
  reviews.value.push({ ...payload, userId: currentUser.value.id, createdAt: new Date().toISOString() })
  persist()
  alert('Review submitted successfully.')
}

function addBlock(payload) {
  blockReports.value.push({ ...payload, userId: currentUser.value.id, createdAt: new Date().toISOString(), status: 'Under admin review' })
  persist()
  alert('Block request sent to admin for review.')
}

function updateStatus({ id, status }) {
  const request = requests.value.find(item => item.id === id)
  if (request) request.status = status
  persist()
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
    @sign-out="signOut"
  />

  <main>
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
          <button class="primary full">Submit request</button>
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
        :user-name="currentUser?.name || 'Customer'"
        @new-request="goTo('services-list')"
        @write-review="addReview"
        @block-helper="addBlock"
      />
    </section>

    <HowItWorksPage v-if="activePage === 'how'" />

    <RegisterPage
      v-if="activePage === 'register'"
      @register="registerUser"
      @go-signin="showSignIn = true"
    />
  </main>

  <FooterSection />

  <SignInModal
    v-if="showSignIn"
    @close="showSignIn = false"
    @sign-in="signIn"
  />
</template>
