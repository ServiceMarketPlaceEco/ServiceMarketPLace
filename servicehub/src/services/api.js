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

// ---------- Services catalog ----------

export async function getServices() {
  return request('/services')
}

export async function getServiceProviders(serviceId) {
  return request(`/services/${serviceId}/providers`)
}

// ---------- Provider self-service ----------

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

export async function updateBookingStatusPublic(bookingId, status) {
  return request(`/bookings/${bookingId}/status`, { method: 'PATCH', body: { status } })
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
