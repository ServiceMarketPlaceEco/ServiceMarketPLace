// Real HTTP client for the NestJS backend.
// Replaces the old localStorage-mock database that used to live here.

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

const TOKEN_KEY = 'servicehub-access-token'
const REFRESH_KEY = 'servicehub-refresh-token'

export function getAccessToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY)
}

export function setTokens(accessToken, refreshToken) {
  if (accessToken) localStorage.setItem(TOKEN_KEY, accessToken)
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken)
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_KEY)
}

async function request(path, { method = 'GET', body, auth = false } = {}) {
  const headers = { 'Content-Type': 'application/json' }

  if (auth) {
    const token = getAccessToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  })

  const text = await res.text()
  const data = text ? JSON.parse(text) : null

  if (!res.ok) {
    const message = Array.isArray(data?.message) ? data.message.join(', ') : (data?.message || `Request failed (${res.status})`)
    throw new Error(message)
  }

  return data
}

// ---------- Auth ----------

export async function registerCustomer(payload) {
  return request('/auth/register/customer', { method: 'POST', body: payload })
}

export async function registerProvider(payload) {
  return request('/auth/register/provider', { method: 'POST', body: payload })
}

export async function login(payload) {
  return request('/auth/login', { method: 'POST', body: payload })
}

// Exchanges a Google ID token for a session. Fails with "This user has not
// been signed up" when no account is registered with the Google email.
export async function loginWithGoogle(credential) {
  return request('/auth/google', { method: 'POST', body: { credential } })
}

export async function forgotPassword(email, userType) {
  return request('/auth/forgot-password', { method: 'POST', body: { email, userType } })
}

export async function resetPassword(token, newPassword) {
  return request('/auth/reset-password', { method: 'POST', body: { token, newPassword } })
}

// ---------- Services catalog ----------

export async function getServices() {
  return request('/services')
}

export async function getServiceProviders(serviceId) {
  return request(`/services/${serviceId}/providers`)
}

// Ranks catalog services against a voice-search transcript (English or Bengali).
// Returns { transcript, interpretation, matches: [{ serviceId, serviceName, confidence, reason }], source }
export async function matchTranscript(transcript, language) {
  return request('/services/match-transcript', { method: 'POST', body: { transcript, language } })
}

// ---------- Provider self-service ----------

export async function getProviderProfile() {
  return request('/providers/me/profile', { auth: true })
}

export async function updateProviderProfile(payload) {
  return request('/providers/me/profile', { method: 'PUT', body: payload, auth: true })
}

export async function changeProviderPassword(payload) {
  return request('/providers/me/change-password', { method: 'PUT', body: payload, auth: true })
}

export async function addProviderService(payload) {
  return request('/providers/me/services', { method: 'POST', body: payload, auth: true })
}

export async function getMyProviderServices() {
  return request('/providers/me/services', { auth: true })
}

export async function updateProviderService(providerServiceId, payload) {
  return request(`/providers/me/services/${providerServiceId}`, { method: 'PUT', body: payload, auth: true })
}

export async function getProviderBookings() {
  return request('/providers/me/bookings', { auth: true })
}

export async function updateProviderBookingStatus(bookingId, status) {
  return request(`/providers/me/bookings/${bookingId}/status`, {
    method: 'PUT',
    body: { status },
    auth: true
  })
}

// ---------- Bookings ----------

export async function createBooking(payload) {
  return request('/bookings', { method: 'POST', body: payload, auth: true })
}

export async function getMyBookings() {
  return request('/bookings/my-bookings', { auth: true })
}

// Public demo endpoints used by the admin dashboard (no auth required by the backend)
export async function getAllBookingsPublic() {
  return request('/bookings/all')
}

export async function updateBookingStatusPublic(bookingId, status, providerId) {
  return request(`/bookings/${bookingId}/status`, { method: 'PATCH', body: { status, providerId } })
}

// ---------- Reviews ----------

export async function getProviderReviews(providerId) {
  return request(`/reviews/provider/${providerId}`)
}

// ---------- Admin ----------

export async function getAllCustomersAdmin(page = 1, limit = 100) {
  return request(`/admins/customers?page=${page}&limit=${limit}`, { auth: true })
}

export async function getAllProvidersAdmin(page = 1, limit = 100) {
  return request(`/admins/providers?page=${page}&limit=${limit}`, { auth: true })
}

export async function verifyProvider(providerId) {
  return request(`/admins/providers/${providerId}/verify`, { method: 'POST', auth: true })
}

export async function suspendUser(userType, id, reason) {
  return request(`/admins/users/${userType}/${id}/suspend`, {
    method: 'POST',
    body: { reason },
    auth: true
  })
}

export async function activateUser(userType, id) {
  return request(`/admins/users/${userType}/${id}/activate`, { method: 'POST', auth: true })
}

// ---------- Review moderation (admin) ----------

export async function scanReviews() {
  return request('/reviews/moderation/scan')
}

export async function keepFlaggedReview(reviewId) {
  return request(`/reviews/moderation/${reviewId}/keep`, { method: 'POST' })
}

export async function removeFlaggedReview(reviewId) {
  return request(`/reviews/moderation/${reviewId}/remove`, { method: 'POST' })
}

// Screen a single review through the Anthropic API for a second opinion.
// This calls Claude to analyze whether the review text looks genuine or fake
// based on the comment content, rating, and the flags already raised.
export async function aiScreenReview(review) {
  const prompt = `You are a review moderation assistant for a service marketplace called ServiceHub in Rajshahi, Bangladesh. Analyze this review and determine if it is likely genuine or likely fake.

Review details:
- Rating: ${review.rating}/5 stars
- Comment: "${review.comment || '(no comment)'}"
- Flags already raised by the rule-based detector: ${review.reasons?.map(r => r.detail).join('; ') || 'none'}
- Review score from detector: ${review.score}

Respond with ONLY a JSON object (no markdown, no backticks):
{"verdict": "genuine" or "suspicious", "explanation": "one sentence explaining why"}`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }]
      })
    })

    const data = await response.json()
    const text = data.content?.[0]?.text || ''
    const clean = text.replace(/```json|```/g, '').trim()
    return JSON.parse(clean)
  } catch (err) {
    return { verdict: 'error', explanation: 'AI screening is not available: ' + err.message }
  }
}

// ---------- Account moderation (admin) ----------

export async function scanAccounts() {
  return request('/providers/moderation/scan')
}

export async function keepFlaggedAccount(accountId) {
  return request(`/providers/moderation/${accountId}/keep`, { method: 'POST' })
}

export async function blockFlaggedAccount(accountId, kind) {
  return request(`/providers/moderation/${accountId}/block`, { method: 'POST', body: { kind } })
}

// Screen a flagged account through Claude for a second opinion.
export async function aiScreenAccount(account) {
  const prompt = `You are an account moderation assistant for a service marketplace called ServiceHub in Rajshahi, Bangladesh. Analyze this account and determine if it is likely genuine or likely fake.

Account details:
- Type: ${account.kind}
- Account ID: ${account.accountId}
- Completed bookings: ${account.completedBookings ?? 'unknown'}
- Reviews written: ${account.reviewsWritten ?? 'n/a'}
- Distinct providers reviewed: ${account.distinctProvidersReviewed ?? 'n/a'}
- Flags raised by the rule-based detector: ${account.reasons?.map(r => r.detail).join('; ') || 'none'}
- Detection score: ${account.score}

Respond with ONLY a JSON object (no markdown, no backticks):
{"verdict": "genuine" or "suspicious", "explanation": "one sentence explaining why"}`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }]
      })
    })

    const data = await response.json()
    const text = data.content?.[0]?.text || ''
    const clean = text.replace(/```json|```/g, '').trim()
    return JSON.parse(clean)
  } catch (err) {
    return { verdict: 'error', explanation: 'AI screening is not available: ' + err.message }
  }
}

// ---------- Reports (used for the "block request" safety workflow) ----------

export async function createReport(payload) {
  return request('/reports', { method: 'POST', body: payload, auth: true })
}

export async function getAllReportsAdmin() {
  return request('/reports', { auth: true })
}

export async function updateReportStatus(id, status) {
  return request(`/reports/${id}/status`, { method: 'PUT', body: { status }, auth: true })
}

// ---------- AI Chatbot ----------

export async function sendChatbotMessage(message, history) {
  return request('/chatbot/message', { method: 'POST', body: { message, history } })
}
