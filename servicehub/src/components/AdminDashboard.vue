<script setup>
// admin dashboard component: marketplace management workspace for users, providers and requests.
import { computed, ref } from 'vue'

const props = defineProps({
  requests: { type: Array, default: () => [] },
  blockRequests: { type: Array, default: () => [] }
})
const emit = defineEmits(['status-change', 'block-status-change', 'sign-out', 'go-home'])

// activeView switches admin content panels without extra routing libraries.
const activeView = ref('dashboard')
const searchTerm = ref('')

// prototype management data for dashboard tables.
const users = ref([
  { name: 'Rafiq Ahmed', email: 'rafiq.ahmed@email.com', phone: '+880 1712-345678', bookings: 24, spent: 45600, status: 'Active' },
  { name: 'Fatima Begum', email: 'fatima.begum@email.com', phone: '+880 1812-456789', bookings: 12, spent: 23400, status: 'Active' },
  { name: 'Karim Hassan', email: 'karim.h@email.com', phone: '+880 1912-567890', bookings: 45, spent: 89200, status: 'Blocked' },
  { name: 'Nusrat Jahan', email: 'nusrat.j@email.com', phone: '+880 1612-678901', bookings: 3, spent: 5800, status: 'Active' }
])

const providers = ref([
  { name: 'Abdul Karim', area: 'Rajshahi City', services: 'AC Repair, Installation', rating: 4.9, jobs: 456, earnings: 892000, status: 'Active' },
  { name: 'Shahidul Islam', area: 'Boalia', services: 'Electrical Wiring, Fan Installation', rating: 4.7, jobs: 312, earnings: 624000, status: 'Active' },
  { name: 'Firoz Ahmed', area: 'Laxmipur', services: 'Painting, Wall Texture', rating: 4.6, jobs: 87, earnings: 261000, status: 'Pending' },
  { name: 'Salam Khan', area: 'Motihar', services: 'Appliance Repair', rating: 'N/A', jobs: 0, earnings: 0, status: 'Pending' }
])

// revenue is calculated from current request data plus sample historic baseline.
const totalRevenue = computed(() => props.requests.reduce((sum, item) => sum + Number(item.total || 0), 45678900))

// visibleRequests supports the admin request search field.
const visibleRequests = computed(() => {
  const q = searchTerm.value.toLowerCase().trim()
  if (!q) return props.requests
  return props.requests.filter(item => `${item.id} ${item.serviceTitle} ${item.customerName} ${item.provider} ${item.status}`.toLowerCase().includes(q))
})

// toggleUserStatus blocks or reactivates a prototype user row.
function toggleUserStatus(user) {
  user.status = user.status === 'Blocked' ? 'Active' : 'Blocked'
}

// toggleProviderStatus blocks or reactivates a prototype provider row.
function toggleProviderStatus(provider) {
  provider.status = provider.status === 'Blocked' ? 'Active' : 'Blocked'
}

// approveProvider changes pending provider applications to active.
function approveProvider(provider) {
  provider.status = 'Active'
}

// Admin approves or rejects block requests submitted by real signed-in users/providers.
function updateBlockStatus(request, status) {
  emit('block-status-change', { id: request.id, status })
}
</script>

<template>
  <section class="ops-layout admin-layout">
    <aside class="ops-sidebar">
      <div class="ops-user">
        <div class="avatar">AD</div>
        <div><strong>Admin Panel</strong><small>admin@servicehub.com</small></div>
      </div>
      <nav class="ops-menu">
        <button :class="{ active: activeView === 'dashboard' }" @click="activeView = 'dashboard'">Dashboard</button>
        <button :class="{ active: activeView === 'users' }" @click="activeView = 'users'">Users</button>
        <button :class="{ active: activeView === 'providers' }" @click="activeView = 'providers'">Service
          providers</button>
        <button :class="{ active: activeView === 'requests' }" @click="activeView = 'requests'">Requests</button>
        <button :class="{ active: activeView === 'analytics' }" @click="activeView = 'analytics'">Analytics</button>
        <button :class="{ active: activeView === 'blocks' }" @click="activeView = 'blocks'">Block requests</button>
        <button :class="{ active: activeView === 'settings' }" @click="activeView = 'settings'">Settings</button>
      </nav>
      <div class="ops-bottom"><button @click="$emit('go-home')">Back to home</button><button
          @click="$emit('sign-out')">Exit admin</button></div>
    </aside>

    <main class="ops-main">
      <header class="ops-topbar">
        <div>
          <h1>{{ activeView === 'dashboard' ? 'Admin dashboard' : activeView }}</h1>
          <p>Manage and monitor the Service Hub marketplace.</p>
        </div><input v-model="searchTerm" placeholder="Search..." />
      </header>

      <template v-if="activeView === 'dashboard'">
        <div class="stat-grid four">
          <article class="stat-card dark"><span>Total users</span><strong>12.5K</strong><small>+12% from last
              month</small></article>
          <article class="stat-card dark"><span>Service providers</span><strong>2.6K</strong><small>+8% from last
              month</small></article>
          <article class="stat-card dark"><span>Total requests</span><strong>89.2K</strong><small>+23% from last
              month</small></article>
          <article class="stat-card dark"><span>Total revenue</span><strong>BDT {{ totalRevenue.toLocaleString()
              }}</strong><small>+18% from last month</small></article>
        </div>
        <div class="stat-grid four compact">
          <article class="stat-card dark"><span>Active requests</span><strong>{{requests.filter(r => r.status !==
              'Completed').length }}</strong></article>
          <article class="stat-card dark"><span>Pending providers</span><strong>{{providers.filter(p => p.status ===
              'Pending').length }}</strong></article>
          <article class="stat-card dark"><span>Blocked users</span><strong>{{users.filter(u => u.status ===
              'Blocked').length }}</strong></article>
          <article class="stat-card dark"><span>Blocked providers</span><strong>{{providers.filter(p => p.status ===
              'Blocked').length }}</strong></article>
        </div>
        <div class="ops-grid two">
          <section class="ops-panel">
            <h2>Recent requests</h2>
            <article v-for="request in requests.slice(0, 4)" :key="request.id" class="request-row">
              <div><strong>{{ request.serviceTitle }}</strong><small>{{ request.customerName }} · {{ request.date
                  }}</small></div><strong>BDT {{ Number(request.total).toLocaleString() }}</strong>
            </article>
          </section>
          <section class="ops-panel">
            <h2>Pending provider approvals</h2>
            <article v-for="provider in providers.filter(p => p.status === 'Pending')" :key="provider.name"
              class="request-row">
              <div><strong>{{ provider.name }}</strong><small>{{ provider.services }}</small></div><button
                class="primary small" @click="approveProvider(provider)">Review</button>
            </article>
          </section>
        </div>
      </template>

      <template v-if="activeView === 'users'">
        <section class="ops-panel">
          <div class="panel-heading">
            <h2>User management</h2><span>Showing {{ users.length }} users</span>
          </div>
          <div class="responsive-table dark-table">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Contact</th>
                  <th>Bookings</th>
                  <th>Total spent</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="user in users" :key="user.email">
                  <td><strong>{{ user.name }}</strong><small>customer account</small></td>
                  <td>{{ user.email }}<small>{{ user.phone }}</small></td>
                  <td>{{ user.bookings }}</td>
                  <td>{{ user.spent.toLocaleString() }}৳</td>
                  <td><span class="status-pill" :class="user.status.toLowerCase()">{{ user.status }}</span></td>
                  <td><button class="secondary small" @click="toggleUserStatus(user)">{{ user.status === 'Blocked' ?
                      'Unblock' : 'Block' }}</button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>

      <template v-if="activeView === 'providers'">
        <section class="ops-panel">
          <div class="panel-heading">
            <h2>Service provider management</h2><span>Showing {{ providers.length }} providers</span>
          </div>
          <div class="responsive-table dark-table">
            <table>
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Services</th>
                  <th>Rating</th>
                  <th>Jobs</th>
                  <th>Earnings</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="provider in providers" :key="provider.name">
                  <td><strong>{{ provider.name }}</strong><small>{{ provider.area }}</small></td>
                  <td>{{ provider.services }}</td>
                  <td>{{ provider.rating }}</td>
                  <td>{{ provider.jobs }}</td>
                  <td>{{ provider.earnings.toLocaleString() }}৳</td>
                  <td><span class="status-pill" :class="provider.status.toLowerCase()">{{ provider.status }}</span></td>
                  <td><button v-if="provider.status === 'Pending'" class="primary small"
                      @click="approveProvider(provider)">Approve</button><button v-else class="secondary small"
                      @click="toggleProviderStatus(provider)">{{ provider.status === 'Blocked' ? 'Unblock' : 'Block'
                      }}</button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>

      <template v-if="activeView === 'requests'">
        <div class="stat-grid six">
          <article v-for="status in ['All', 'Pending', 'Accepted', 'In Progress', 'Completed', 'Declined']" :key="status"
            class="stat-card dark"><span>{{ status }}</span><strong>{{status === 'All' ? requests.length :
              requests.filter(r => r.status === status).length }}</strong></article>
        </div>
        <section class="ops-panel">
          <h2>Service requests</h2>
          <div class="responsive-table dark-table">
            <table>
              <thead>
                <tr>
                  <th>Request ID</th>
                  <th>Service</th>
                  <th>Customer</th>
                  <th>Provider</th>
                  <th>Schedule</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="request in visibleRequests" :key="request.id">
                  <td><strong>{{ request.id }}</strong></td>
                  <td>{{ request.serviceTitle }}</td>
                  <td>{{ request.customerName }}</td>
                  <td>{{ request.provider }}</td>
                  <td>{{ request.date }}<small>{{ request.time }}</small></td>
                  <td>{{ request.total }}৳</td>
                  <td><span class="status-pill" :class="request.status.toLowerCase().replace(' ', '-')">{{
                      request.status }}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>


      <template v-if="activeView === 'blocks'">
        <section class="ops-panel">
          <div class="panel-heading">
            <h2>Block requests</h2><span>{{ blockRequests.length }} submitted</span>
          </div>
          <div v-if="blockRequests.length === 0" class="empty-state">No block requests yet.</div>
          <div v-else class="responsive-table dark-table">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Requested by</th>
                  <th>Target</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="request in blockRequests" :key="request.id">
                  <td><strong>{{ request.id }}</strong></td>
                  <td>{{ request.requesterName }}<small>{{ request.requesterRole }}</small></td>
                  <td>{{ request.targetName }}<small>{{ request.targetRole }}</small></td>
                  <td>{{ request.reason }}</td>
                  <td><span class="status-pill" :class="request.status.toLowerCase()">{{ request.status }}</span></td>
                  <td class="row-actions"><button class="success small"
                      @click="updateBlockStatus(request, 'Approved')">Approve</button><button class="secondary small"
                      @click="updateBlockStatus(request, 'Rejected')">Reject</button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>

      <template v-if="activeView === 'analytics'">
        <section class="ops-panel">
          <h2>Marketplace analytics</h2>
          <div class="analytics-grid">
            <article><span>Conversion rate</span><strong>38%</strong>
              <p>request submissions from service views</p>
            </article>
            <article><span>Average response time</span><strong>22 min</strong>
              <p>provider first response estimate</p>
            </article>
            <article><span>Top area</span><strong>Rajshahi City</strong>
              <p>highest request volume</p>
            </article>
          </div>
        </section>
      </template>

      <template v-if="activeView === 'settings'">
        <section class="ops-panel settings-panel">
          <h2>Admin settings</h2>
          <div class="settings-grid"><label>Platform name<input value="Service Hub" /></label><label>Default city<input
                value="Rajshahi City" /></label><label>Support email<input
                value="support@servicehub.com" /></label><label>Theme plan<input
                value="dark and light theme toggle planned" /></label></div><button class="primary">Save
            settings</button>
        </section>
      </template>
    </main>
  </section>
</template>
