<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  // Service data is used to suggest the most relevant booking option.
  services: { type: Array, default: () => [] },
})

// Sends the checked transcript and selected service back to ServiceGrid.
const emit = defineEmits(['confirmed'])

const modalOpen = ref(false)
const language = ref('en-AU')
const transcript = ref('')
const errorMessage = ref('')
const isListening = ref(false)
const selectedService = ref(null)
const transcriptInput = ref(null)

let recognition = null
let restartTimer = null

// Support both the standard API and the prefix currently used by some browsers.
const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition
const speechSupported = Boolean(SpeechRecognition)

// Frontend prototype vocabulary. Bengali terms are associated with the English
// words currently used in ServiceHub's service titles and descriptions.
// A future backend AI endpoint can replace this dictionary and scoring logic.
const bengaliToEnglish = {
  পরিষ্কার: 'cleaning',
  পরিচ্ছন্নতা: 'cleaning',
  ক্লিনিং: 'cleaning',
  ঘর: 'home',
  বাসা: 'home',
  বাড়ি: 'home',
  সরানো: 'moving',
  স্থানান্তর: 'moving',
  পরিবহন: 'transport',
  গাড়ি: 'transport',
  ডেলিভারি: 'delivery',
  সরবরাহ: 'delivery',
  পার্সেল: 'delivery',
  ওষুধ: 'medicine',
  খাবার: 'food',
  এসি: 'ac',
  'এয়ার কন্ডিশনার': 'ac',
  মেরামত: 'repair',
  নষ্ট: 'repair',
  প্রযুক্তি: 'technology',
  কম্পিউটার: 'computer',
  শিক্ষক: 'tutor',
  টিউটর: 'tutor',
  পড়াশোনা: 'education',
  শিক্ষা: 'education',
  যত্ন: 'care',
  সেবা: 'service',
}

const ignoredWords = new Set([
  'a', 'an', 'and', 'for', 'i', 'in', 'is', 'me', 'my', 'need',
  'of', 'please', 'someone', 'the', 'to', 'want', 'with',
  'আমার', 'আমি', 'একটি', 'জন্য', 'চাই', 'দরকার', 'করতে',
])

function normaliseText(value) {
  let result = String(value ?? '').toLowerCase().trim()

  Object.entries(bengaliToEnglish).forEach(([bengali, english]) => {
    if (result.includes(bengali.toLowerCase())) result += ` ${english}`
  })

  return result
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function usefulTokens(value) {
  return normaliseText(value)
    .split(' ')
    .filter((word) => word.length > 1 && !ignoredWords.has(word))
}

// Title matches are weighted more strongly than category or description matches.
function scoreService(service, spokenRequest) {
  const title = normaliseText(service.title)
  const category = normaliseText(service.category)
  const description = normaliseText(service.description)

  return usefulTokens(spokenRequest).reduce((score, token) => {
    if (title.includes(token)) return score + 5
    if (category.includes(token)) return score + 3
    if (description.includes(token)) return score + 1
    return score
  }, 0)
}

// Show up to five likely services for the user to verify.
const suggestedServices = computed(() =>
  props.services
    .map((service) => ({
      service,
      score: scoreService(service, transcript.value),
    }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((result) => result.service),
)

// Preselect the best match, while keeping the selection editable.
watch(suggestedServices, (services) => {
  const selectionIsStillValid = services.some(
    (service) => service.id === selectedService.value?.id,
  )

  if (!selectionIsStillValid) {
    selectedService.value = services[0] ?? null
  }
})

function stopListening() {
  if (recognition && isListening.value) recognition.stop()
}

// Clicking the microphone opens the popup and begins listening immediately.
function openVoiceSearch() {
  modalOpen.value = true
  transcript.value = ''
  errorMessage.value = ''
  selectedService.value = null
  nextTick(startListening)
}

function startListening() {
  errorMessage.value = ''

  if (!SpeechRecognition) {
    errorMessage.value =
      'Voice recognition is unavailable in this browser. Type your request below instead.'
    nextTick(() => transcriptInput.value?.focus())
    return
  }

  if (recognition && isListening.value) recognition.abort()

  recognition = new SpeechRecognition()
  recognition.lang = language.value
  recognition.continuous = false
  recognition.interimResults = true
  recognition.maxAlternatives = 1

  recognition.onstart = () => {
    isListening.value = true
  }

  // Interim results make the transcript appear while the user is speaking.
  recognition.onresult = (event) => {
    let words = ''

    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      words += event.results[index][0].transcript
    }

    transcript.value = words.trim()
  }

  recognition.onerror = (event) => {
    const messages = {
      'not-allowed':
        'Microphone permission was denied. Allow access or type your request.',
      'no-speech':
        'No speech was detected. Select Try again and speak clearly.',
      network:
        'Voice recognition could not connect. Check your connection.',
      'language-not-supported':
        'This language is not supported by your current browser.',
    }

    errorMessage.value =
      messages[event.error] ||
      'The speech could not be recognised. Try again or edit the transcript.'
  }

  recognition.onend = () => {
    isListening.value = false
  }

  try {
    recognition.start()
  } catch (error) {
    console.error('Voice-search error:', error)
    isListening.value = false
    errorMessage.value =
      'The microphone could not start. Try again or type your request.'
  }
}

// Changing languages clears the old transcript and records again in the new language.
function restartForLanguage() {
  if (recognition) recognition.abort()
  transcript.value = ''
  errorMessage.value = ''
  selectedService.value = null

  clearTimeout(restartTimer)
  restartTimer = setTimeout(startListening, 150)
}

function closeVoiceSearch() {
  clearTimeout(restartTimer)
  stopListening()
  modalOpen.value = false
  errorMessage.value = ''
}

// Return the confirmed result. ServiceGrid then opens BookingPanel through its
// existing request-service event.
function confirmVoiceSearch() {
  if (!transcript.value.trim()) {
    errorMessage.value =
      language.value === 'bn-BD'
        ? 'চালিয়ে যাওয়ার আগে আপনার অনুরোধ বলুন বা লিখুন।'
        : 'Speak or type your request before continuing.'
    return
  }

  if (!selectedService.value) {
    errorMessage.value =
      language.value === 'bn-BD'
        ? 'কোনো পরিষেবা শনাক্ত করা যায়নি। অনুরোধটি আরও স্পষ্ট করুন।'
        : 'No service was detected. Please make the request more specific.'
    return
  }

  emit('confirmed', {
    transcript: transcript.value.trim(),
    service: selectedService.value,
    language: language.value,
  })

  closeVoiceSearch()
}

onBeforeUnmount(() => {
  clearTimeout(restartTimer)
  stopListening()
})
</script>

<template>
  <!-- This standalone component renders the button beside the search input. -->
  <button
    class="voice-button"
    type="button"
    aria-label="Search for a service using voice"
    title="Voice search"
    @click="openVoiceSearch"
  >
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a1 1 0 1 1 2 0 7 7 0 0 1-6 6.93V20h3a1 1 0 1 1 0 2H8a1 1 0 1 1 0-2h3v-2.07A7 7 0 0 1 5 11a1 1 0 1 1 2 0 5 5 0 0 0 10 0Z"
      />
    </svg>
  </button>

  <!-- Teleport prevents the modal from being clipped by ServiceGrid containers. -->
  <Teleport to="body">
    <div
      v-if="modalOpen"
      class="voice-modal-backdrop"
      @click.self="closeVoiceSearch"
    >
      <section
        class="voice-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="voice-modal-title"
      >
        <button
          class="voice-close"
          type="button"
          aria-label="Close voice search"
          @click="closeVoiceSearch"
        >
          ×
        </button>

        <div class="voice-orb" :class="{ listening: isListening }">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a1 1 0 1 1 2 0 7 7 0 0 1-6 6.93V20h3a1 1 0 1 1 0 2H8a1 1 0 1 1 0-2h3v-2.07A7 7 0 0 1 5 11a1 1 0 1 1 2 0 5 5 0 0 0 10 0Z"
            />
          </svg>
        </div>

        <p class="voice-eyebrow">AI voice service finder</p>
        <h2 id="voice-modal-title">
          {{ isListening ? 'Listening…' : 'Check your request' }}
        </h2>
        <p class="voice-help">
          Speak naturally, then correct the transcript before continuing.
        </p>

        <fieldset class="language-choice">
          <legend>Recognition language</legend>
          <label>
            <input
              v-model="language"
              type="radio"
              value="en-AU"
              @change="restartForLanguage"
            />
            English
          </label>
          <label>
            <input
              v-model="language"
              type="radio"
              value="bn-BD"
              @change="restartForLanguage"
            />
            বাংলা (Bengali)
          </label>
        </fieldset>

        <label class="transcript-field">
          Transcript
          <textarea
            ref="transcriptInput"
            v-model="transcript"
            rows="4"
            :placeholder="
              language === 'bn-BD'
                ? 'উদাহরণ: আমার বাসার এসি মেরামত করতে হবে'
                : 'Example: I need someone to repair my air conditioner'
            "
          ></textarea>
        </label>

        <label v-if="suggestedServices.length" class="service-match-field">
          Suggested service
          <select v-model="selectedService">
            <option
              v-for="service in suggestedServices"
              :key="service.id"
              :value="service"
            >
              {{ service.title }} — {{ service.category }}
            </option>
          </select>
        </label>

        <p
          v-else-if="transcript.trim()"
          class="voice-warning"
          aria-live="polite"
        >
          No clear service match yet. Edit the transcript or record again.
        </p>

        <p v-if="errorMessage" class="voice-error" role="alert">
          {{ errorMessage }}
        </p>

        <p v-if="!speechSupported" class="voice-warning">
          Voice recognition is unsupported here, but typed confirmation remains available.
        </p>

        <div class="voice-actions">
          <button
            class="voice-secondary"
            type="button"
            @click="isListening ? stopListening() : startListening()"
          >
            {{ isListening ? 'Stop recording' : 'Try again' }}
          </button>
          <button
            class="voice-primary"
            type="button"
            :disabled="!transcript.trim() || !selectedService"
            @click="confirmVoiceSearch"
          >
            Continue to booking
          </button>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.voice-button {
  position: absolute;
  top: 50%;
  right: 0.75rem;
  display: grid;
  width: 2.85rem;
  height: 2.85rem;
  padding: 0.7rem;
  border: 0;
  border-radius: 50%;
  background: linear-gradient(135deg, #7c3aed, #5b21b6);
  color: #fff;
  cursor: pointer;
  transform: translateY(-50%);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.voice-button:hover {
  box-shadow: 0 0 0 0.35rem rgb(124 58 237 / 16%);
  transform: translateY(-50%) scale(1.05);
}

.voice-button svg,
.voice-orb svg {
  width: 100%;
  fill: currentColor;
}

.voice-modal-backdrop {
  position: fixed;
  z-index: 2000;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 1.25rem;
  background: rgb(15 8 31 / 62%);
  backdrop-filter: blur(8px);
}

.voice-modal {
  position: relative;
  width: min(100%, 42rem);
  max-height: 90vh;
  overflow-y: auto;
  padding: 2.25rem;
  border: 1px solid #dfd1ff;
  border-radius: 2rem;
  background: var(--surface, #fff);
  color: var(--text, #160d2d);
  box-shadow: 0 1.5rem 5rem rgb(30 15 60 / 28%);
}

.voice-close {
  position: absolute;
  top: 1rem;
  right: 1rem;
  border: 0;
  background: transparent;
  color: inherit;
  font-size: 2rem;
  cursor: pointer;
}

.voice-orb {
  display: grid;
  width: 5rem;
  height: 5rem;
  margin-bottom: 1.25rem;
  padding: 1.35rem;
  border-radius: 50%;
  background: #ede9fe;
  color: #6d28d9;
}

.voice-orb.listening {
  background: linear-gradient(135deg, #8b5cf6, #5b21b6);
  color: #fff;
  animation: voice-pulse 1.15s infinite;
}

.voice-eyebrow {
  margin: 0 0 0.45rem;
  color: #6d28d9;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.voice-help {
  color: var(--muted, #6f6684);
}

.language-choice {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin: 1.25rem 0;
  padding: 0;
  border: 0;
}

.language-choice legend,
.transcript-field,
.service-match-field {
  width: 100%;
  margin-bottom: 0.55rem;
  font-weight: 800;
}

.language-choice label {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.65rem;
  min-height: 44px;
  padding: 0.7rem 1rem;
  border: 1px solid #d9c9ff;
  border-radius: 999px;
  cursor: pointer;
}

/* Override the project's text-input sizing for these native radio controls. */
.language-choice input[type='radio'] {
  appearance: none;
  -webkit-appearance: none;
  flex: 0 0 1.15rem;
  width: 1.15rem;
  height: 1.15rem;
  min-height: 0;
  margin: 0;
  padding: 0;
  border: 2px solid #6d28d9;
  border-radius: 50%;
  background: var(--surface, #fff);
}

.language-choice input[type='radio']:checked {
  border-width: 5px;
}

.language-choice label:has(input:checked) {
  border-color: #6d28d9;
  background: var(--brand-soft, #ede9fe);
}

.language-choice input[type='radio']:focus-visible {
  outline: 3px solid rgb(124 58 237 / 35%);
  outline-offset: 3px;
}

.transcript-field,
.service-match-field {
  display: grid;
  gap: 0.55rem;
  margin-top: 1rem;
}

.transcript-field textarea,
.service-match-field select {
  width: 100%;
  padding: 0.9rem 1rem;
  border: 1px solid #d9c9ff;
  border-radius: 1rem;
  background: var(--surface, #fff);
  color: var(--text, #160d2d);
  font: inherit;
  box-sizing: border-box;
}

.voice-error,
.voice-warning {
  margin: 0.85rem 0 0;
  color: #b42318;
  font-weight: 700;
}

.voice-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.voice-primary,
.voice-secondary {
  padding: 0.8rem 1.1rem;
  border-radius: 999px;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}

.voice-primary {
  border: 0;
  background: #6d28d9;
  color: #fff;
}

.voice-secondary {
  border: 1px solid #d9c9ff;
  background: transparent;
  color: inherit;
}

.voice-primary:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

@keyframes voice-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgb(124 58 237 / 35%);
  }

  50% {
    box-shadow: 0 0 0 1rem rgb(124 58 237 / 0%);
  }
}

@media (max-width: 600px) {
  .voice-modal {
    padding: 1.5rem;
    border-radius: 1.4rem;
  }

  .voice-actions {
    align-items: stretch;
    flex-direction: column-reverse;
  }
}
</style>
