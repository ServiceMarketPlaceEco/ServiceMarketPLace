<script setup>
import { computed, ref } from 'vue'
import { formatStatus } from '../../data/services'

const props = defineProps({
  accounts: { type: Array, default: () => [] },
  requests: { type: Array, default: () => [] },
  chatApprovals: { type: Array, default: () => [] },
  blockRequests: { type: Array, default: () => [] },
  theme: { type: String, default: 'light' }
})

const emit = defineEmits(['approve-provider', 'reject-provider', 'activate-provider', 'block-customer', 'activate-customer', 'assign-request', 'approve-chat', 'reject-chat', 'block-status-change', 'reset-db', 'sign-out', 'go-home', 'toggle-theme'])

const activeView = ref('dashboard')
const searchTerm = ref('')
const selectedProviders = ref({})

const customerAccounts = computed(() => props.accounts.filter(account => account.role === 'customer'))
const providerAccounts = computed(() => props.accounts.filter(account => account.role === 'provider'))
const activeProviders = computed(() => providerAccounts.value.filter(account => account.status === 'active'))
const pendingProviders = computed(() => providerAccounts.value.filter(account => account.status === 'pending-admin-approval'))
const waitingRequests = computed(() => props.requests.filter(request => ['waiting-admin-approval', 'provider-declined'].includes(request.status)))
const assignedRequests = computed(() => props.requests.filter(request => request.providerId))
const totalRevenue = computed(() => props.requests.reduce((sum, item) => sum + Number(item.budget || item.total || 0), 0))
const visibleRequests = computed(() => {
  const q = searchTerm.value.toLowerCase().trim()
  if (!q) return props.requests
  return props.requests.filter(item => `${item.id} ${item.serviceTitle} ${item.customerName} ${item.status}`.toLowerCase().includes(q))
})

function providerName(providerId) { return props.accounts.find(account => account.id === providerId)?.name || 'Not assigned' }
function assignProvider(request) {
  const providerId = selectedProviders.value[request.id]
  if (!providerId) return alert('Please choose an active provider before assigning the request.')
  emit('assign-request', { requestId: request.id, providerId })
}
</script>

<template>
  <section class="ops-layout modern-ops-layout admin-layout">
    <aside class="ops-sidebar modern-sidebar">
      <div class="ops-user compact-user">
        <div><strong>Admin Panel</strong><small>admin@servicehub.local</small></div>
      </div>

      <nav class="ops-menu modern-menu">
        <button :class="{ active: activeView === 'dashboard' }" @click="activeView = 'dashboard'">Dashboard</button>
        <button :class="{ active: activeView === 'users' }" @click="activeView = 'users'">Users</button>
        <button :class="{ active: activeView === 'providers' }" @click="activeView = 'providers'">Service
          providers</button>
        <button :class="{ active: activeView === 'requests' }" @click="activeView = 'requests'">Requests</button>
        <button :class="{ active: activeView === 'chat' }" @click="activeView = 'chat'">Chat approvals</button>
        <button :class="{ active: activeView === 'analytics' }" @click="activeView = 'analytics'">Analytics</button>
        <button :class="{ active: activeView === 'blocks' }" @click="activeView = 'blocks'">Block requests</button>
        <button :class="{ active: activeView === 'settings' }" @click="activeView = 'settings'">Settings</button>
      </nav>

      <div class="ops-bottom modern-bottom">
        <button class="secondary" type="button" @click="$emit('toggle-theme')">{{ theme === 'dark' ? 'Light mode' :
          'Dark mode' }}</button>
        <span class="ops-role-pill">Admin</span>
        <button class="danger-soft" type="button" @click="$emit('sign-out')">Log out</button>
      </div>
    </aside>

    <main class="ops-main">
      <header class="ops-topbar">
        <div>
          <h1>{{ activeView === 'dashboard' ? 'Admin dashboard' : activeView }}</h1>
          <p>Manage users, provider approvals, request assignment and chat approval.</p>
        </div><input v-model="searchTerm" placeholder="Search admin workspace..." />
      </header>

      <template v-if="activeView === 'dashboard'">
        <div class="stat-grid four">
          <article class="stat-card"><span>Total users</span><strong>{{ customerAccounts.length
              }}</strong></article>
          <article class="stat-card"><span>Service providers</span><strong>{{ providerAccounts.length
              }}</strong><small>{{ pendingProviders.length }} pending approval</small></article>
          <article class="stat-card"><span>Total requests</span><strong>{{ requests.length }}</strong><small>{{
            waitingRequests.length }} waiting assignment</small></article>
          <article class="stat-card"><span>Total revenue</span><strong>BDT {{ totalRevenue.toLocaleString() }}</strong>
          </article>
        </div>
        <div class="ops-grid two">
          <section class="ops-panel">
            <h2>Recent requests</h2>
            <div v-if="requests.length === 0" class="empty-state">No service requests submitted yet.</div>
            <article v-for="request in requests.slice(0, 4)" :key="request.id" class="request-row">
              <div><strong>{{ request.serviceTitle }}</strong><small>{{ request.customerName }} · {{
                request.preferredDate }}</small></div><strong>BDT {{ Number(request.budget || 0).toLocaleString()
                }}</strong>
            </article>
          </section>
          <section class="ops-panel">
            <h2>Pending provider approvals</h2>
            <div v-if="pendingProviders.length === 0" class="empty-state">No real provider applications pending.</div>
            <article v-for="provider in pendingProviders" :key="provider.id" class="request-row">
              <div><strong>{{ provider.name }}</strong><small>{{ provider.serviceType }} · {{ provider.email }}</small>
              </div>
              <div class="row-actions"><button class="primary small"
                  @click="$emit('approve-provider', provider.id)">Approve</button><button class="secondary small"
                  @click="$emit('reject-provider', provider.id)">Reject</button></div>
            </article>
          </section>
        </div>
      </template>

      <template v-if="activeView === 'users'">
        <section class="ops-panel">
          <div class="panel-heading">
            <h2>User management</h2><span>Showing {{ customerAccounts.length }} users</span>
          </div>
          <div class="responsive-table">
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
                <tr v-for="account in customerAccounts" :key="account.id">
                  <td><strong>{{ account.name }}</strong></td>
                  <td>{{ account.email }}<small>{{ account.phone }}</small></td>
                  <td>{{requests.filter(r => r.customerId === account.id).length}}</td>
                  <td>{{requests.filter(r => r.customerId === account.id).reduce((sum, r) => sum + Number(r.budget || 0), 0).toLocaleString()}}৳</td>
                  <td><span class="status-pill" :class="account.status">{{ account.status }}</span></td>
                  <td><button class="secondary small" @click="account.status === 'blocked' ? $emit('activate-customer', account.id) : $emit('block-customer', account.id)">{{ account.status === 'blocked' ?
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
            <h2>Service provider management</h2><span>Showing {{ providerAccounts.length }} providers</span>
          </div>
          <div class="responsive-table">
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
                <tr v-for="provider in providerAccounts" :key="provider.id">
                  <td><strong>{{ provider.name }}</strong><small>{{ provider.area || 'Service area pending' }}</small>
                  </td>
                  <td>{{ provider.serviceType || 'General service' }}</td>
                  <td>N/A</td>
                  <td>{{requests.filter(r => r.providerId === provider.id).length}}</td>
                  <td>{{requests.filter(r => r.providerId === provider.id).reduce((sum, r) => sum + Number(r.budget || 0), 0).toLocaleString()}}৳</td>
                  <td><span class="status-pill" :class="provider.status">{{ provider.status }}</span></td>
                  <td class="row-actions"><button v-if="provider.status === 'pending-admin-approval'"
                      class="primary small" @click="$emit('approve-provider', provider.id)">Approve</button><button
                      v-if="provider.status === 'pending-admin-approval'" class="secondary small"
                      @click="$emit('reject-provider', provider.id)">Reject</button><button
                      v-else-if="provider.status === 'blocked'" class="primary small"
                      @click="$emit('activate-provider', provider.id)">Unblock</button><button v-else
                      class="secondary small" @click="$emit('reject-provider', provider.id)">Block</button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>

      <template v-if="activeView === 'requests'">
        <div class="stat-grid four">
          <article class="stat-card"><span>Waiting</span><strong>{{ waitingRequests.length }}</strong></article>
          <article class="stat-card"><span>Assigned</span><strong>{{ assignedRequests.length }}</strong></article>
          <article class="stat-card"><span>Completed</span><strong>{{requests.filter(r => r.status ===
              'completed').length }}</strong></article>
          <article class="stat-card"><span>Total</span><strong>{{ requests.length }}</strong></article>
        </div>
        <section class="ops-panel">
          <h2>Service request approval and provider assignment</h2>
          <div v-if="requests.length === 0" class="empty-state">No customer service requests yet.</div>
          <div v-else class="responsive-table">
            <table>
              <thead>
                <tr>
                  <th>Request ID</th>
                  <th>Service</th>
                  <th>Customer</th>
                  <th>Provider</th>
                  <th>Schedule</th>
                  <th>Amount</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th>Assign</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="request in visibleRequests" :key="request.id">
                  <td><strong>{{ request.id }}</strong></td>
                  <td>{{ request.serviceTitle }}</td>
                  <td>{{ request.customerName }}</td>
                  <td>{{ providerName(request.providerId) }}<small>{{ formatStatus(request.providerStatus) }}</small></td>
                  <td>{{ request.preferredDate }}<small>{{ request.location }}</small></td>
                  <td>{{ request.budget || 0 }}৳</td>
                  <td><span class="status-pill" :class="request.needsUpfrontPayment ? 'pending' : 'active'">{{
                    request.needsUpfrontPayment ? 'bank upfront' : 'after service' }}</span><small
                      v-if="request.needsUpfrontPayment">{{ request.bankName }} · {{ request.accountName }}</small></td>
                  <td><span class="status-pill"
                      :class="String(request.status).toLowerCase().replaceAll('_', '-').replaceAll(' ', '-')">{{
                      formatStatus(request.status) }}</span></td>
                  <td>
                    <div class="row-actions"><select
                        :value="selectedProviders[request.id] ?? request.providerId ?? ''"
                        @change="selectedProviders[request.id] = $event.target.value">
                        <option value="">Choose provider</option>
                        <option v-for="provider in activeProviders" :key="provider.id" :value="provider.id">{{
                          provider.name }} - {{ provider.serviceType }}</option>
                      </select><button class="primary small" @click="assignProvider(request)">Approve + assign</button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>

      <template v-if="activeView === 'chat'">
        <section class="ops-panel">
          <div class="panel-heading">
            <h2>Chat approval requests</h2><span>{{ chatApprovals.length }} submitted</span>
          </div>
          <p class="muted">User/provider chat is locked until admin approves the request.</p>
          <div v-if="chatApprovals.length === 0" class="empty-state">No chat approval requests yet.</div>
          <div v-else class="responsive-table">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Request</th>
                  <th>Requested by</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="approval in chatApprovals" :key="approval.id">
                  <td><strong>{{ approval.id }}</strong></td>
                  <td>{{ approval.requestId }}</td>
                  <td>{{ approval.requestedBy }}</td>
                  <td><span class="status-pill" :class="approval.status">{{ approval.status }}</span></td>
                  <td class="row-actions"><button class="success small"
                      @click="$emit('approve-chat', approval.id)">Approve</button><button class="secondary small"
                      @click="$emit('reject-chat', approval.id)">Reject</button></td>
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
          <div v-else class="responsive-table">
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
                      @click="$emit('block-status-change', { id: request.id, status: 'Approved' })">Approve</button><button
                      class="secondary small"
                      @click="$emit('block-status-change', { id: request.id, status: 'Rejected' })">Reject</button></td>
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
          <div class="settings-grid"><label>Platform name<input value="ServiceHub" /></label><label>Default city<input
                value="Rajshahi City" /></label><label>Support email<input
                value="support@servicehub.com" /></label><label>Backend status<input
                value="ready for database API connection" /></label></div>
          <div class="form-actions"><button class="secondary" @click="$emit('reset-db')">Reset local demo
              data</button><button class="primary">Save settings</button></div>
        </section>
      </template>
    </main>
  </section>
</template>
