<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'

const props = defineProps({
  requests: {
    type: Array,
    default: () => []
  },
  signedInUser: Object
})

const emit = defineEmits(['back'])

// Each entry represents mock data that would normally arrive from the backend
// through polling, WebSockets or push notifications.
const trackingStages = [
  {
    key: 'confirmed',
    label: 'Booking confirmed',
    shortLabel: 'Confirmed',
    title: 'Your booking has been confirmed',
    message: 'ServiceHub has received your request and is finding a verified provider.',
    eta: 34,
    distance: 8.6,
    progress: 4
  },
  {
    key: 'assigned',
    label: 'Provider allocated',
    shortLabel: 'Allocated',
    title: 'A provider has been allocated',
    message: 'Rahim Service Team accepted your booking and is preparing to travel.',
    eta: 27,
    distance: 7.1,
    progress: 15
  },
  {
    key: 'preparing',
    label: 'Preparing equipment',
    shortLabel: 'Preparing',
    title: 'Your provider is preparing',
    message: 'The required tools have been checked. Your provider will depart shortly.',
    eta: 21,
    distance: 6.4,
    progress: 25
  },
  {
    key: 'on-the-way',
    label: 'Provider on the way',
    shortLabel: 'On the way',
    title: 'Your provider is on the way',
    message: 'Rahim is travelling towards your service address in Rajshahi.',
    eta: 15,
    distance: 4.8,
    progress: 44
  },
  {
    key: 'nearby',
    label: 'Provider is nearby',
    shortLabel: 'Nearby',
    title: 'Your provider is nearby',
    message: 'Rahim is approximately 5 minutes away. Please make sure the location is accessible.',
    eta: 5,
    distance: 1.2,
    progress: 76
  },
  {
    key: 'arrived',
    label: 'Provider arrived',
    shortLabel: 'Arrived',
    title: 'Your provider has arrived',
    message: 'Rahim has reached the service address and is ready to begin.',
    eta: 0,
    distance: 0,
    progress: 96
  },
  {
    key: 'completed',
    label: 'Service completed',
    shortLabel: 'Completed',
    title: 'Service completed',
    message: 'Your service has been marked as complete. Thank you for using ServiceHub.',
    eta: 0,
    distance: 0,
    progress: 100
  }
]

const selectedRequestIndex = ref(0)
const activeStageIndex = ref(0)
const isSimulationRunning = ref(false)
const browserNotificationsEnabled = ref(false)
const latestToast = ref('')
const notificationLog = ref([])
let simulationTimer = null
let toastTimer = null

const fallbackBooking = {
  id: 'DEMO-2401',
  serviceTitle: 'Home Cleaning',
  customerLocation: 'Boalia, Rajshahi',
  location: 'House 18, Boalia Main Road, Rajshahi',
  preferredDate: 'Today',
  preferredTime: '3:30 PM',
  providerName: 'Rahim Service Team',
  providerPhone: '+880 1712 345 678'
}

const availableBookings = computed(() => {
  return props.requests.length ? props.requests : [fallbackBooking]
})

const booking = computed(() => {
  return availableBookings.value[selectedRequestIndex.value] || fallbackBooking
})

const stage = computed(() => trackingStages[activeStageIndex.value])
const isFinished = computed(() => activeStageIndex.value === trackingStages.length - 1)
const destination = computed(() => {
  return booking.value.customerLocation || booking.value.location || 'Rajshahi City'
})
const providerName = computed(() => booking.value.providerName || fallbackBooking.providerName)
const providerPhone = computed(() => booking.value.providerPhone || fallbackBooking.providerPhone)
const bookingReference = computed(() => booking.value.id || booking.value.requestId || fallbackBooking.id)

function formatClock(date = new Date()) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function sendUpdate(stageData) {
  const update = {
    id: `${stageData.key}-${Date.now()}`,
    title: stageData.title,
    message: stageData.message,
    time: formatClock(),
    stage: stageData.key
  }

  notificationLog.value.unshift(update)
  latestToast.value = `${update.title}: ${update.message}`

  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    latestToast.value = ''
  }, 5000)

  // Optional real browser notification. The prototype still works when the
  // user declines permission because all updates remain visible on the page.
  if (
    browserNotificationsEnabled.value &&
    typeof Notification !== 'undefined' &&
    Notification.permission === 'granted'
  ) {
    new Notification(`ServiceHub — ${update.title}`, {
      body: update.message,
      tag: `servicehub-${stageData.key}`
    })
  }
}

function advanceStage() {
  if (isFinished.value) {
    stopSimulation()
    return
  }

  activeStageIndex.value += 1
  sendUpdate(stage.value)

  if (isFinished.value) stopSimulation()
}

function startSimulation() {
  if (isFinished.value) resetSimulation()
  if (isSimulationRunning.value) return

  isSimulationRunning.value = true

  if (!notificationLog.value.length) sendUpdate(stage.value)

  // Four seconds represents a backend status update in this frontend demo.
  simulationTimer = setInterval(advanceStage, 4000)
}

function stopSimulation() {
  isSimulationRunning.value = false
  if (simulationTimer) {
    clearInterval(simulationTimer)
    simulationTimer = null
  }
}

function resetSimulation() {
  stopSimulation()
  activeStageIndex.value = 0
  notificationLog.value = []
  latestToast.value = ''
}

function changeBooking() {
  resetSimulation()
}

async function enableBrowserNotifications() {
  if (typeof Notification === 'undefined') {
    latestToast.value = 'Browser notifications are not supported on this device.'
    return
  }

  const permission = await Notification.requestPermission()
  browserNotificationsEnabled.value = permission === 'granted'
  latestToast.value = permission === 'granted'
    ? 'Browser progress notifications are enabled.'
    : 'Notification permission was not enabled. In-app updates will still appear.'
}

function callProvider() {
  // Opening a tel link is safe for the prototype and works on supported devices.
  window.location.href = `tel:${providerPhone.value.replace(/\s/g, '')}`
}

onBeforeUnmount(() => {
  stopSimulation()
  clearTimeout(toastTimer)
})
</script>

<template>
  <section class="tracking-page" aria-labelledby="tracking-title">
    <header class="tracking-header">
      <div>
        <button class="back-button" type="button" @click="emit('back')">
          <span aria-hidden="true">←</span> Back
        </button>
        <p class="eyebrow">Live service tracking prototype</p>
        <h1 id="tracking-title">Track your service</h1>
        <p>
          Mock backend events automatically update the provider location, ETA and customer messages.
        </p>
      </div>

      <div v-if="availableBookings.length > 1" class="booking-selector">
        <label for="tracking-booking">Choose a booking</label>
        <select id="tracking-booking" v-model.number="selectedRequestIndex" @change="changeBooking">
          <option v-for="(item, index) in availableBookings" :key="item.id || index" :value="index">
            {{ item.serviceTitle || 'Service request' }} — {{ item.id || index + 1 }}
          </option>
        </select>
      </div>
    </header>

    <div class="tracking-grid">
      <article class="map-card">
        <div class="map-toolbar">
          <div>
            <span class="live-indicator"><i></i> Live prototype</span>
            <strong>{{ stage.shortLabel }}</strong>
          </div>
          <button v-if="!browserNotificationsEnabled" class="notification-button" type="button"
            @click="enableBrowserNotifications">
            Enable notifications
          </button>
          <span v-else class="notifications-on">Notifications on</span>
        </div>

        <div class="mock-map" aria-label="Simulated provider route to customer address">
          <div class="road road-one"></div>
          <div class="road road-two"></div>
          <div class="road road-three"></div>

          <div class="map-place place-one">Shaheb Bazar</div>
          <div class="map-place place-two">Boalia</div>

          <div class="route-line">
            <div class="route-complete" :style="{ width: `${stage.progress}%` }"></div>
          </div>

          <div class="provider-marker" :class="{ arrived: stage.key === 'arrived' || stage.key === 'completed' }"
            :style="{ left: `${Math.min(stage.progress, 92)}%` }">
            <span aria-hidden="true">🚙</span>
            <small>{{ providerName }}</small>
          </div>

          <div class="customer-marker">
            <span aria-hidden="true">⌂</span>
            <small>Your address</small>
          </div>
        </div>

        <div class="journey-summary">
          <div>
            <span>Estimated arrival</span>
            <strong>{{ stage.eta ? `${stage.eta} min` : stage.key === 'completed' ? 'Completed' : 'Arrived' }}</strong>
          </div>
          <div>
            <span>Distance away</span>
            <strong>{{ stage.distance ? `${stage.distance.toFixed(1)} km` : 'At address' }}</strong>
          </div>
          <div>
            <span>Destination</span>
            <strong>{{ destination }}</strong>
          </div>
        </div>
      </article>

      <aside class="status-panel">
        <div class="booking-overview">
          <div>
            <p class="eyebrow">Booking {{ bookingReference }}</p>
            <h2>{{ booking.serviceTitle || 'Local service' }}</h2>
            <p>{{ booking.preferredDate || 'Today' }} · {{ booking.preferredTime || 'Scheduled service' }}</p>
          </div>
          <span class="status-chip">{{ stage.shortLabel }}</span>
        </div>

        <div class="current-update" aria-live="polite">
          <span class="update-icon" aria-hidden="true">{{ isFinished ? '✓' : '●' }}</span>
          <div>
            <p>Current update</p>
            <h3>{{ stage.title }}</h3>
            <span>{{ stage.message }}</span>
          </div>
        </div>

        <ol class="tracking-timeline" aria-label="Service progress">
          <li v-for="(item, index) in trackingStages" :key="item.key" :class="{
            complete: index < activeStageIndex,
            active: index === activeStageIndex
          }">
            <span class="timeline-dot">{{ index < activeStageIndex ? '✓' : index + 1 }}</span>
                <div>
                  <strong>{{ item.label }}</strong>
                  <small v-if="index === activeStageIndex">Current status</small>
                  <small v-else-if="index < activeStageIndex">Update sent</small>
                  <small v-else>Waiting</small>
                </div>
          </li>
        </ol>

        <div class="simulation-controls">
          <button v-if="!isSimulationRunning && !isFinished" class="primary-button" type="button"
            @click="startSimulation">
            Start live demonstration
          </button>
          <button v-else-if="isSimulationRunning" class="outline-button" type="button" @click="stopSimulation">
            Pause demonstration
          </button>
          <button v-else class="primary-button" type="button" @click="resetSimulation">
            Replay demonstration
          </button>

          <button class="text-button" type="button" :disabled="isFinished" @click="advanceStage">
            Send next mock update
          </button>
        </div>
      </aside>
    </div>

    <div class="lower-grid">
      <article class="provider-card">
        <div class="provider-avatar" aria-hidden="true">RS</div>
        <div>
          <p>Your allocated provider</p>
          <h2>{{ providerName }}</h2>
          <div class="rating"><span aria-hidden="true">★</span> 4.9 · Verified local provider</div>
        </div>
        <button class="outline-button compact" type="button" @click="callProvider">Call provider</button>
      </article>

      <article class="message-card">
        <div class="message-heading">
          <div>
            <p class="eyebrow">Progress messages</p>
            <h2>ServiceHub updates</h2>
          </div>
          <span>{{ notificationLog.length }} messages</span>
        </div>

        <div v-if="notificationLog.length" class="message-list" aria-live="polite">
          <article v-for="update in notificationLog" :key="update.id">
            <span class="message-icon" aria-hidden="true">S</span>
            <div>
              <div><strong>{{ update.title }}</strong><time>{{ update.time }}</time></div>
              <p>{{ update.message }}</p>
            </div>
          </article>
        </div>
        <div v-else class="empty-messages">
          Start the demonstration to receive simulated backend progress messages.
        </div>
      </article>
    </div>

    <div v-if="latestToast" class="tracking-toast" role="status" aria-live="assertive">
      <span aria-hidden="true">✓</span>
      {{ latestToast }}
    </div>
  </section>
</template>

<style scoped>
.tracking-page {
  width: min(1380px, calc(100% - 40px));
  margin: 0 auto;
  padding: 42px 0 72px;
  color: var(--text, #170b31);
}

.tracking-header {
  display: flex;
  justify-content: space-between;
  align-items: end;
  gap: 28px;
  margin-bottom: 26px;
}

.tracking-header h1 {
  margin: 5px 0 8px;
  font-size: clamp(2.4rem, 5vw, 4.6rem);
  line-height: 1;
  letter-spacing: -.055em;
}

.tracking-header>div>p:last-child {
  max-width: 720px;
  margin: 0;
  color: var(--muted, #6c6480);
  line-height: 1.6;
}

.eyebrow {
  margin: 0;
  color: #6d2eed;
  font-size: .76rem;
  font-weight: 950;
  letter-spacing: .17em;
  text-transform: uppercase;
}

.back-button {
  border: 0;
  margin-bottom: 24px;
  padding: 0;
  background: transparent;
  color: #632bdd;
  font: inherit;
  font-weight: 900;
  cursor: pointer;
}

.booking-selector {
  display: grid;
  min-width: min(100%, 310px);
  gap: 7px;
}

.booking-selector label {
  font-weight: 850;
}

.booking-selector select {
  min-height: 48px;
  border: 1px solid var(--line, #ded2ff);
  border-radius: 13px;
  padding: 0 13px;
  background: var(--surface, #fff);
  color: var(--text, #170b31);
  font: inherit;
}

.tracking-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(350px, .65fr);
  gap: 22px;
}

.map-card,
.status-panel,
.provider-card,
.message-card {
  border: 1px solid var(--line, #dfd4fa);
  border-radius: 26px;
  background: var(--surface, #fff);
  box-shadow: 0 18px 52px rgba(40, 19, 80, .08);
}

.map-card {
  overflow: hidden;
}

.map-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 18px;
  padding: 20px 22px;
}

.map-toolbar>div {
  display: flex;
  align-items: center;
  gap: 16px;
}

.live-indicator {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: #553f69;
  font-size: .78rem;
  font-weight: 850;
  text-transform: uppercase;
}

.live-indicator i {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #23bd78;
  box-shadow: 0 0 0 5px rgba(35, 189, 120, .14);
}

.notification-button,
.notifications-on {
  border: 1px solid var(--line, #ded2ff);
  border-radius: 999px;
  padding: 9px 13px;
  background: transparent;
  color: var(--text, #170b31);
  font: inherit;
  font-size: .82rem;
  font-weight: 850;
}

.notification-button {
  cursor: pointer;
}

.notifications-on {
  color: #14754c;
  background: rgba(35, 189, 120, .09);
}

.mock-map {
  position: relative;
  min-height: 480px;
  overflow: hidden;
  background-color: #eeeaf5;
  background-image: linear-gradient(rgba(255, 255, 255, .48) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, .48) 1px, transparent 1px);
  background-size: 36px 36px;
}

.road {
  position: absolute;
  height: 30px;
  border: 2px solid rgba(255, 255, 255, .9);
  border-radius: 999px;
  background: #d7d2df;
  transform-origin: left center;
}

.road-one {
  top: 15%;
  left: -5%;
  width: 112%;
  transform: rotate(15deg);
}

.road-two {
  top: 65%;
  left: -8%;
  width: 120%;
  transform: rotate(-11deg);
}

.road-three {
  top: -10%;
  left: 48%;
  width: 90%;
  transform: rotate(88deg);
}

.map-place {
  position: absolute;
  z-index: 2;
  border-radius: 9px;
  padding: 5px 8px;
  background: rgba(255, 255, 255, .78);
  color: #6d6479;
  font-size: .72rem;
  font-weight: 800;
}

.place-one {
  top: 24%;
  right: 18%;
}

.place-two {
  bottom: 19%;
  left: 20%;
}

.route-line {
  position: absolute;
  z-index: 3;
  top: 55%;
  left: 10%;
  width: 78%;
  height: 8px;
  border-radius: 999px;
  background: rgba(95, 45, 210, .2);
  transform: rotate(-5deg);
}

.route-complete {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #5f2bd5, #8b4bff);
  transition: width .7s ease;
}

.provider-marker,
.customer-marker {
  position: absolute;
  z-index: 5;
  display: grid;
  justify-items: center;
  gap: 4px;
  transform: translate(-50%, -50%);
}

.provider-marker {
  top: 49%;
  transition: left .8s cubic-bezier(.2, .8, .2, 1);
}

.provider-marker>span {
  display: grid;
  width: 50px;
  height: 50px;
  place-items: center;
  border: 4px solid #fff;
  border-radius: 50%;
  background: #632bdd;
  box-shadow: 0 10px 22px rgba(65, 26, 138, .28);
  font-size: 1.5rem;
}

.provider-marker small,
.customer-marker small {
  white-space: nowrap;
  border-radius: 8px;
  padding: 5px 8px;
  background: #201033;
  color: #fff;
  font-weight: 800;
}

.customer-marker {
  top: 44%;
  right: 3%;
}

.customer-marker>span {
  display: grid;
  width: 51px;
  height: 51px;
  place-items: center;
  border: 4px solid #fff;
  border-radius: 50% 50% 50% 10%;
  background: #ff5a86;
  color: #fff;
  box-shadow: 0 10px 22px rgba(130, 28, 72, .24);
  font-size: 1.5rem;
  transform: rotate(-45deg);
}

.customer-marker>span::first-letter {
  transform: rotate(45deg);
}

.journey-summary {
  display: grid;
  grid-template-columns: .7fr .7fr 1.6fr;
  border-top: 1px solid var(--line, #dfd4fa);
}

.journey-summary>div {
  display: grid;
  gap: 6px;
  padding: 20px;
  border-right: 1px solid var(--line, #dfd4fa);
}

.journey-summary>div:last-child {
  border-right: 0;
}

.journey-summary span {
  color: var(--muted, #6c6480);
  font-size: .78rem;
  font-weight: 750;
}

.journey-summary strong {
  line-height: 1.3;
}

.status-panel {
  padding: 25px;
}

.booking-overview {
  display: flex;
  justify-content: space-between;
  gap: 15px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--line, #dfd4fa);
}

.booking-overview h2 {
  margin: 5px 0;
  font-size: 1.7rem;
}

.booking-overview>div>p:last-child {
  margin: 0;
  color: var(--muted, #6c6480);
}

.status-chip {
  align-self: start;
  border-radius: 999px;
  padding: 8px 11px;
  background: #eee6ff;
  color: #5f24d5;
  font-size: .78rem;
  font-weight: 900;
}

.current-update {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 14px;
  margin: 20px 0;
  border-radius: 18px;
  padding: 18px;
  background: linear-gradient(135deg, #f0e9ff, #faf7ff);
  color: #23103d;
}

.update-icon {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: 50%;
  background: #682ce5;
  color: #fff;
}

.current-update p {
  margin: 0 0 4px;
  color: #6d31e6;
  font-size: .74rem;
  font-weight: 900;
  text-transform: uppercase;
}

.current-update h3 {
  margin: 0 0 5px;
}

.current-update div>span {
  color: #675d76;
  line-height: 1.5;
}

.tracking-timeline {
  margin: 0;
  padding: 0;
  list-style: none;
}

.tracking-timeline li {
  position: relative;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 12px;
  min-height: 49px;
  color: #8a8297;
}

.tracking-timeline li:not(:last-child)::after {
  content: '';
  position: absolute;
  top: 25px;
  bottom: 0;
  left: 13px;
  width: 2px;
  background: #e5dff0;
}

.timeline-dot {
  z-index: 1;
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border-radius: 50%;
  background: #ece8f1;
  color: #786f85;
  font-size: .72rem;
  font-weight: 900;
}

.tracking-timeline li.complete,
.tracking-timeline li.active {
  color: var(--text, #170b31);
}

.tracking-timeline li.complete .timeline-dot,
.tracking-timeline li.active .timeline-dot {
  background: #682ce5;
  color: #fff;
}

.tracking-timeline li.active .timeline-dot {
  box-shadow: 0 0 0 5px rgba(104, 44, 229, .14);
}

.tracking-timeline strong,
.tracking-timeline small {
  display: block;
}

.tracking-timeline small {
  margin-top: 3px;
  color: var(--muted, #6c6480);
}

.simulation-controls {
  display: grid;
  gap: 9px;
  margin-top: 20px;
}

.primary-button,
.outline-button {
  min-height: 48px;
  border-radius: 13px;
  padding: 0 17px;
  font: inherit;
  font-weight: 900;
  cursor: pointer;
}

.primary-button {
  border: 0;
  background: linear-gradient(135deg, #5925d8, #7936f2);
  color: #fff;
  box-shadow: 0 10px 24px rgba(94, 38, 212, .22);
}

.outline-button {
  border: 1px solid var(--line, #d9ccf7);
  background: transparent;
  color: var(--text, #170b31);
}

.text-button {
  border: 0;
  padding: 8px;
  background: transparent;
  color: #642adf;
  font: inherit;
  font-weight: 850;
  cursor: pointer;
}

.text-button:disabled {
  color: #aaa2b3;
  cursor: not-allowed;
}

.lower-grid {
  display: grid;
  grid-template-columns: .65fr 1.35fr;
  gap: 22px;
  margin-top: 22px;
}

.provider-card {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 16px;
  padding: 23px;
}

.provider-avatar {
  display: grid;
  width: 58px;
  height: 58px;
  place-items: center;
  border-radius: 17px;
  background: linear-gradient(145deg, #20103c, #7332ef);
  color: #fff;
  font-weight: 950;
}

.provider-card p,
.provider-card h2 {
  margin: 0;
}

.provider-card p {
  color: var(--muted, #6c6480);
  font-size: .8rem;
}

.provider-card h2 {
  margin-top: 3px;
  font-size: 1.3rem;
}

.rating {
  margin-top: 5px;
  color: var(--muted, #6c6480);
  font-size: .83rem;
}

.rating span {
  color: #f49c06;
}

.compact {
  min-height: 42px;
}

.message-card {
  padding: 23px;
}

.message-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 18px;
  margin-bottom: 17px;
}

.message-heading h2 {
  margin: 4px 0 0;
}

.message-heading>span {
  border-radius: 999px;
  padding: 7px 10px;
  background: #f0e9ff;
  color: #642adf;
  font-size: .76rem;
  font-weight: 900;
}

.message-list {
  display: grid;
  max-height: 315px;
  overflow-y: auto;
  gap: 11px;
}

.message-list>article {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 11px;
  border-radius: 15px;
  padding: 13px;
  background: var(--background, #faf8ff);
}

.message-icon {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: 10px;
  background: #682ce5;
  color: #fff;
  font-weight: 950;
}

.message-list article div>div {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.message-list time {
  color: var(--muted, #6c6480);
  font-size: .76rem;
}

.message-list p {
  margin: 5px 0 0;
  color: var(--muted, #6c6480);
  line-height: 1.45;
}

.empty-messages {
  border: 1px dashed var(--line, #d9ccf7);
  border-radius: 15px;
  padding: 28px;
  color: var(--muted, #6c6480);
  text-align: center;
}

.tracking-toast {
  position: fixed;
  z-index: 1000;
  right: 24px;
  bottom: 24px;
  display: flex;
  max-width: min(430px, calc(100% - 48px));
  align-items: flex-start;
  gap: 10px;
  border-radius: 16px;
  padding: 15px 17px;
  background: #211034;
  color: #fff;
  box-shadow: 0 18px 48px rgba(28, 11, 52, .32);
  line-height: 1.45;
}

.tracking-toast>span {
  display: grid;
  flex: 0 0 24px;
  height: 24px;
  place-items: center;
  border-radius: 50%;
  background: #6f32e9;
}

button:focus-visible,
select:focus-visible {
  outline: 3px solid #a984ff;
  outline-offset: 3px;
}

@media (max-width: 1050px) {

  .tracking-grid,
  .lower-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 680px) {
  .tracking-page {
    width: min(100% - 24px, 1380px);
    padding-top: 24px;
  }

  .tracking-header {
    display: grid;
    align-items: start;
  }

  .booking-selector {
    width: 100%;
  }

  .mock-map {
    min-height: 380px;
  }

  .journey-summary {
    grid-template-columns: 1fr 1fr;
  }

  .journey-summary>div:last-child {
    grid-column: 1 / -1;
    border-top: 1px solid var(--line, #dfd4fa);
  }

  .provider-card {
    grid-template-columns: auto 1fr;
  }

  .provider-card .compact {
    grid-column: 1 / -1;
  }
}

@media (prefers-reduced-motion: reduce) {
  * {
    transition: none !important;
    scroll-behavior: auto !important;
  }
}
</style>
