<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { formatStatus } from '../../data/services'
import * as api from '../../services/api'
import L from 'leaflet'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import 'leaflet/dist/leaflet.css'

// Leaflet's default marker icon paths break once bundled; point them at the
// bundler-resolved URLs instead.
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow
})

const providerIcon = L.divIcon({
  className: 'provider-marker',
  html: '<span>P</span>',
  iconSize: [32, 32],
  iconAnchor: [16, 16]
})
const customerIcon = L.divIcon({
  className: 'customer-marker',
  html: '<span>C</span>',
  iconSize: [32, 32],
  iconAnchor: [16, 16]
})

const props = defineProps({
  requests: { type: Array, default: () => [] },
  selectedRequest: { type: Object, default: null }
})

const emit = defineEmits(['back'])
const selectedRequestId = ref(props.selectedRequest?.id || props.selectedRequest?.requestId || '')

watch(() => props.selectedRequest, request => {
  selectedRequestId.value = request?.id || request?.requestId || ''
})

const booking = computed(() => props.requests.find(item => (item.id || item.requestId) === selectedRequestId.value)
  || props.selectedRequest
  || props.requests[0]
  || null)

const stages = [
  { key: 'pending', label: 'Request received' },
  { key: 'assigned', label: 'Provider assigned' },
  { key: 'in-progress', label: 'Service in progress' },
  { key: 'completed', label: 'Service completed' }
]

const statusAliases = {
  pending: 'pending',
  'waiting-admin-approval': 'pending',
  'waiting-provider-acceptance': 'pending',
  confirmed: 'assigned',
  accepted: 'assigned',
  assigned: 'assigned',
  'assigned-to-provider': 'assigned',
  in_progress: 'in-progress',
  'in-progress': 'in-progress',
  completed: 'completed',
  cancelled: 'cancelled',
  declined: 'cancelled'
}

const currentStatus = computed(() => {
  const status = booking.value?.providerStatus || booking.value?.status || 'pending'
  return statusAliases[status] || 'pending'
})

const currentStageIndex = computed(() => {
  if (currentStatus.value === 'cancelled') return -1
  return Math.max(0, stages.findIndex(stage => stage.key === currentStatus.value))
})

const statusMessage = computed(() => ({
  pending: 'Your request has been received and is waiting for a provider.',
  assigned: 'A provider has been assigned and will contact you before travelling.',
  'in-progress': 'Your provider has started the service.',
  completed: 'Your provider has marked this service as completed.',
  cancelled: 'This booking has been cancelled.'
}[currentStatus.value]))

const bookingReference = computed(() => booking.value?.id || booking.value?.requestId || 'Pending')
const destination = computed(() => booking.value?.location || booking.value?.customerLocation || 'Not provided')

// ---------- Live map ----------
// Only an assigned/in-progress booking has anything meaningful to track: a
// provider to follow, moving toward the customer. The provider's position
// is polled from the backend; the customer's own position is captured once
// (with their permission) as a fixed reference point on the map.
const showMap = computed(() => ['assigned', 'in-progress'].includes(currentStatus.value))
const locationUnavailable = ref(false)

const mapEl = ref(null)
let map = null
let providerMarker = null
let customerMarker = null
let pollTimer = null

const providerPosition = ref(null)
const customerPosition = ref(null)

const RAJSHAHI_CENTER = [24.3745, 88.6042]

function ensureMap() {
  if (map || !mapEl.value) return
  map = L.map(mapEl.value).setView(RAJSHAHI_CENTER, 13)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(map)
}

function fitMapToMarkers() {
  if (!map) return
  const points = [providerMarker, customerMarker].filter(Boolean).map(marker => marker.getLatLng())
  if (points.length === 1) map.setView(points[0], 14)
  else if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [48, 48] })
}

watch(providerPosition, position => {
  if (!position || !map) return
  const latLng = [position.lat, position.lng]
  if (providerMarker) providerMarker.setLatLng(latLng)
  else {
    providerMarker = L.marker(latLng, { icon: providerIcon })
      .addTo(map)
      .bindPopup(booking.value?.providerName || 'Your provider')
  }
  fitMapToMarkers()
})

watch(customerPosition, position => {
  if (!position || !map) return
  const latLng = [position.lat, position.lng]
  if (customerMarker) customerMarker.setLatLng(latLng)
  else customerMarker = L.marker(latLng, { icon: customerIcon }).addTo(map).bindPopup('Your location')
  fitMapToMarkers()
})

async function pollProviderPosition() {
  if (!booking.value?.id) return
  try {
    const fresh = await api.getBookingById(booking.value.id)
    if (fresh?.providerLat != null && fresh?.providerLng != null) {
      providerPosition.value = { lat: Number(fresh.providerLat), lng: Number(fresh.providerLng) }
    }
  } catch {
    // A single failed poll isn't worth surfacing - the next one will retry.
  }
}

function stopPolling() {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = null
}

function startPolling() {
  stopPolling()
  pollProviderPosition()
  pollTimer = setInterval(pollProviderPosition, 5000)
}

function captureCustomerPosition() {
  if (!navigator.geolocation || customerPosition.value) return
  navigator.geolocation.getCurrentPosition(
    pos => { customerPosition.value = { lat: pos.coords.latitude, lng: pos.coords.longitude } },
    () => { locationUnavailable.value = true },
    { timeout: 8000 }
  )
}

watch(showMap, async visible => {
  if (!visible) {
    stopPolling()
    return
  }
  await nextTick()
  ensureMap()
  captureCustomerPosition()
  startPolling()
}, { immediate: true })

watch(() => booking.value?.id, () => {
  providerMarker?.remove()
  providerMarker = null
  providerPosition.value = null
  if (showMap.value) startPolling()
})

onBeforeUnmount(() => {
  stopPolling()
  map?.remove()
  map = null
})

function callProvider() {
  const phone = String(booking.value?.providerPhone || '').replace(/[^+\d]/g, '')
  if (phone) window.location.href = `tel:${phone}`
}
</script>

<template>
  <section class="tracking-page" aria-labelledby="tracking-title">
    <header class="tracking-header">
      <div>
        <button class="back-button" type="button" @click="emit('back')">
          <span aria-hidden="true">←</span> Back to dashboard
        </button>
        <p class="eyebrow">Service tracking</p>
        <h1 id="tracking-title">Track your booking</h1>
        <p>Follow the latest status reported by ServiceHub and your assigned provider.</p>
      </div>

      <label v-if="requests.length > 1" class="booking-selector">
        Choose a booking
        <select v-model="selectedRequestId">
          <option v-for="item in requests" :key="item.id || item.requestId" :value="item.id || item.requestId">
            {{ item.serviceTitle || 'Service request' }} — {{ item.id || item.requestId }}
          </option>
        </select>
      </label>
    </header>

    <div v-if="!booking" class="clean-card empty-state">
      <h2>No booking selected</h2>
      <p>Your submitted bookings will appear here when tracking information is available.</p>
      <button class="primary" type="button" @click="emit('back')">Return to dashboard</button>
    </div>

    <template v-else>
      <div class="tracking-grid">
        <article class="clean-card booking-card">
          <div class="booking-heading">
            <div>
              <p class="eyebrow">Booking {{ bookingReference }}</p>
              <h2>{{ booking.serviceTitle || 'Local service' }}</h2>
            </div>
            <span class="status-pill" :class="currentStatus">{{ formatStatus(currentStatus) }}</span>
          </div>

          <dl class="booking-details">
            <div>
              <dt>Service address</dt>
              <dd>{{ destination }}</dd>
            </div>
            <div>
              <dt>Preferred date</dt>
              <dd>{{ booking.preferredDate || booking.createdAt || 'To be confirmed' }}</dd>
            </div>
            <div>
              <dt>Preferred time</dt>
              <dd>{{ booking.preferredTime || 'To be confirmed' }}</dd>
            </div>
            <div>
              <dt>Provider</dt>
              <dd>{{ booking.providerName || 'Waiting for assignment' }}</dd>
            </div>
          </dl>

          <div class="current-update" role="status" aria-live="polite">
            <span aria-hidden="true">{{ currentStatus === 'cancelled' ? '!' : '✓' }}</span>
            <div>
              <strong>{{ formatStatus(currentStatus) }}</strong>
              <p>{{ statusMessage }}</p>
            </div>
          </div>
        </article>

        <aside class="clean-card progress-card">
          <h2>Booking progress</h2>
          <ol class="tracking-timeline">
            <li v-for="(stage, index) in stages" :key="stage.key" :class="{
              complete: currentStageIndex >= index,
              active: currentStageIndex === index
            }">
              <span class="timeline-dot">{{ currentStageIndex > index ? '✓' : index + 1 }}</span>
              <div>
                <strong>{{ stage.label }}</strong>
                <small v-if="currentStageIndex === index">Current status</small>
                <small v-else-if="currentStageIndex > index">Completed</small>
                <small v-else>Pending</small>
              </div>
            </li>
          </ol>
          <p v-if="currentStatus === 'cancelled'" class="cancelled-message">
            Contact ServiceHub support if you need help with this cancelled booking.
          </p>
        </aside>
      </div>

      <article v-if="showMap" class="clean-card map-card">
        <div class="map-heading">
          <h2>Live location</h2>
          <p v-if="!providerPosition" class="map-hint">Waiting for your provider to share their location…</p>
          <p v-else class="map-hint">Your provider's position updates automatically every few seconds.</p>
        </div>
        <div ref="mapEl" class="map-canvas"></div>
        <p v-if="locationUnavailable" class="map-hint">
          We couldn't access your location, so only your provider is shown on the map.
        </p>
      </article>

      <article v-if="booking.providerName" class="clean-card provider-card">
        <div class="provider-avatar" aria-hidden="true">{{ booking.providerName.charAt(0).toUpperCase() }}</div>
        <div>
          <p>Your assigned provider</p>
          <h2>{{ booking.providerName }}</h2>
          <span>Verified ServiceHub provider</span>
        </div>
        <button v-if="booking.providerPhone" class="secondary" type="button" @click="callProvider">
          Call provider
        </button>
      </article>
    </template>
  </section>
</template>

<style scoped>
.tracking-page {
  width: min(1180px, calc(100% - 40px));
  margin: 0 auto;
  padding: clamp(2.5rem, 6vw, 5rem) 0;
}

.tracking-header,
.booking-heading,
.provider-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
}

.tracking-header {
  align-items: end;
  margin-bottom: 1.75rem;
}

.tracking-header h1 {
  margin: .35rem 0 .65rem;
  font-size: clamp(2.4rem, 5vw, 4.2rem);
  line-height: 1;
}

.tracking-header p:last-child {
  margin: 0;
  color: var(--muted);
}

.back-button {
  margin-bottom: 1.25rem;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--brand);
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}

.booking-selector {
  display: grid;
  gap: .45rem;
  min-width: min(100%, 22rem);
  font-weight: 800;
}

.tracking-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(18rem, .65fr);
  gap: 1.5rem;
}

.booking-card,
.progress-card,
.provider-card,
.empty-state {
  padding: clamp(1.5rem, 4vw, 2.5rem);
}

.booking-heading h2,
.provider-card h2 {
  margin: .2rem 0 0;
}

.booking-details {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
  margin: 2rem 0;
}

.booking-details div {
  padding: 1rem;
  border: 1px solid var(--line);
  border-radius: 1rem;
}

.booking-details dt {
  margin-bottom: .35rem;
  color: var(--muted);
  font-size: .82rem;
  font-weight: 800;
}

.booking-details dd {
  margin: 0;
  color: var(--heading);
  font-weight: 800;
}

.current-update {
  display: flex;
  gap: 1rem;
  padding: 1.25rem;
  border-radius: 1rem;
  background: color-mix(in srgb, var(--brand) 10%, var(--surface));
}

.current-update>span,
.timeline-dot {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  background: var(--brand);
  color: white;
  font-weight: 900;
}

.current-update p {
  margin: .35rem 0 0;
  color: var(--muted);
}

.tracking-timeline {
  display: grid;
  gap: 1rem;
  margin: 1.5rem 0 0;
  padding: 0;
  list-style: none;
}

.tracking-timeline li {
  display: flex;
  align-items: center;
  gap: .85rem;
  opacity: .48;
}

.tracking-timeline li.complete,
.tracking-timeline li.active {
  opacity: 1;
}

.tracking-timeline li:not(.complete) .timeline-dot {
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--muted);
}

.tracking-timeline div {
  display: grid;
}

.tracking-timeline small,
.provider-card p,
.provider-card span {
  color: var(--muted);
}

.cancelled-message {
  margin-top: 1.5rem;
  color: #b42318;
}

.map-card {
  margin-top: 1.5rem;
}

.map-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: .5rem 1rem;
  margin-bottom: 1rem;
}

.map-heading h2 {
  margin: 0;
}

.map-hint {
  margin: 0;
  color: var(--muted);
  font-size: .9rem;
}

.map-canvas {
  width: 100%;
  height: 22rem;
  border-radius: 1rem;
  overflow: hidden;
}

:deep(.provider-marker),
:deep(.customer-marker) {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 2px solid white;
  border-radius: 50%;
  box-shadow: 0 2px 8px rgb(0 0 0 / 25%);
  color: white;
  font-weight: 900;
}

:deep(.provider-marker) {
  background: var(--brand, #6d28d9);
}

:deep(.customer-marker) {
  background: #0f9d58;
}

.provider-card {
  margin-top: 1.5rem;
}

.provider-avatar {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 50%;
  background: var(--brand);
  color: white;
  font-size: 1.25rem;
  font-weight: 900;
}

.provider-card>div:nth-child(2) {
  flex: 1;
}

.provider-card p {
  margin: 0;
}

@media (max-width: 760px) {

  .tracking-header,
  .booking-heading,
  .provider-card {
    align-items: stretch;
    flex-direction: column;
  }

  .tracking-grid,
  .booking-details {
    grid-template-columns: 1fr;
  }
}
</style>
