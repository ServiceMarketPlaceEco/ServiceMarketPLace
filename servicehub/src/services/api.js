// ServiceHub HTTP client for the NestJS backend
// This file contains no mock data or browser-side mock database

const BASE_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

const TOKEN_KEY = 'servicehub-access-token'
const REFRESH_KEY = 'servicehub-refresh-token'

// ---------- Token management ----------

export function getAccessToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY)
}

export function setTokens(accessToken, refreshToken) {
  if (accessToken) {
    localStorage.setItem(TOKEN_KEY, accessToken)
  } else {
    localStorage.removeItem(TOKEN_KEY)
  }

  if (refreshToken) {
    localStorage.setItem(REFRESH_KEY, refreshToken)
  } else {
    localStorage.removeItem(REFRESH_KEY)
  }
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_KEY)
}

// Sends the browser to the backend-managed Google OAuth route
export function beginGoogleSignIn(flow = 'signin') {
  const returnUrl = `${window.location.origin}/auth/google/callback`

  const query = new URLSearchParams({
    flow,
    returnUrl
  })

  window.location.assign(
    `${BASE_URL}/auth/google?${query.toString()}`
  )
}

// ---------- HTTP request helpers ----------

async function parseResponse(response) {
  if (response.status === 204) {
    return null
  }

  const text = await response.text()

  if (!text) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch {
    // Prevent JSON.parse errors if NestJS returns text or an HTML error page
    return { message: text }
  }
}

function getErrorMessage(data, response) {
  if (Array.isArray(data?.message)) {
    return data.message.join(', ')
  }

  return (
    data?.message ||
    data?.error ||
    `Request failed (${response.status})`
  )
}

async function refreshSession() {
  const refreshToken = getRefreshToken()

  if (!refreshToken) {
    return false
  }

  let response

  try {
    response = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({ refreshToken })
    })
  } catch {
    return false
  }

  const data = await parseResponse(response)

  if (!response.ok || !data?.accessToken) {
    clearTokens()
    return false
  }

  setTokens(
    data.accessToken,
    data.refreshToken || refreshToken
  )

  return true
}

async function request(
  path,
  options = {},
  allowRefresh = true
) {
  const {
    method = 'GET',
    body,
    auth = false
  } = options

  const headers = {
    Accept: 'application/json'
  }

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  if (auth) {
    const accessToken = getAccessToken()

    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`
    }
  }

  let response

  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body:
        body !== undefined
          ? JSON.stringify(body)
          : undefined
    })
  } catch {
    throw new Error(
      'Cannot connect to the ServiceHub backend. ' +
      'Check that the backend is running and VITE_API_URL is correct.'
    )
  }

  // Try to obtain a new access token when the current token expires
  if (
    response.status === 401 &&
    auth &&
    allowRefresh &&
    getRefreshToken()
  ) {
    const refreshed = await refreshSession()

    if (refreshed) {
      return request(path, options, false)
    }
  }

  const data = await parseResponse(response)

  if (!response.ok) {
    throw new Error(getErrorMessage(data, response))
  }

  return data
}

// Supports APIs returning an array, { data: [] }, or { items: [] }
function resultArray(result) {
  if (Array.isArray(result)) {
    return result
  }

  if (Array.isArray(result?.data)) {
    return result.data
  }

  if (Array.isArray(result?.items)) {
    return result.items
  }

  return []
}

// ---------- Authentication ----------

export function requestCustomerPhoneVerification({ phone }) {
  return request('/auth/phone-verification/request', {
    method: 'POST',
    body: { phone }
  })
}

export function verifyCustomerPhoneCode({
  verificationId,
  phone,
  code
}) {
  return request('/auth/phone-verification/verify', {
    method: 'POST',
    body: {
      verificationId,
      phone,
      code
    }
  })
}

export function registerCustomer(payload) {
  return request('/auth/register/customer', {
    method: 'POST',
    body: payload
  })
}

export function registerProvider(payload) {
  return request('/auth/register/provider', {
    method: 'POST',
    body: payload
  })
}

export function login(payload) {
  return request('/auth/login', {
    method: 'POST',
    body: payload
  })
}

export function forgotPassword(email, userType) {
  return request('/auth/forgot-password', {
    method: 'POST',
    body: {
      email,
      userType
    }
  })
}

export function resetPassword(token, newPassword) {
  return request('/auth/reset-password', {
    method: 'POST',
    body: {
      token,
      newPassword
    }
  })
}

// ---------- Services catalogue ----------

export async function getServices() {
  const result = await request('/services')
  return resultArray(result)
}

export async function getServiceProviders(serviceId) {
  const result = await request(
    `/services/${encodeURIComponent(serviceId)}/providers`
  )

  return resultArray(result)
}

// ---------- Customer bookings ----------

export function createBooking(payload) {
  return request('/bookings', {
    method: 'POST',
    body: payload,
    auth: true
  })
}

export async function getMyBookings() {
  const result = await request('/bookings/my-bookings', {
    auth: true
  })

  return resultArray(result)
}

// These are the current public demonstration endpoints
export async function getAllBookingsPublic() {
  const result = await request('/bookings/all')
  return resultArray(result)
}

export function updateBookingStatusPublic(
  bookingId,
  status,
  providerId
) {
  return request(
    `/bookings/${encodeURIComponent(bookingId)}/status`,
    {
      method: 'PATCH',
      body: {
        status,
        providerId
      }
    }
  )
}

// ---------- Provider self-service ----------

export function getProviderProfile() {
  return request('/providers/me/profile', {
    auth: true
  })
}

export function updateProviderProfile(payload) {
  return request('/providers/me/profile', {
    method: 'PUT',
    body: payload,
    auth: true
  })
}

export function changeProviderPassword(payload) {
  return request('/providers/me/change-password', {
    method: 'PUT',
    body: payload,
    auth: true
  })
}

export function addProviderService(payload) {
  return request('/providers/me/services', {
    method: 'POST',
    body: payload,
    auth: true
  })
}

export async function getMyProviderServices() {
  const result = await request('/providers/me/services', {
    auth: true
  })

  return resultArray(result)
}

export function updateProviderService(
  providerServiceId,
  payload
) {
  return request(
    `/providers/me/services/${encodeURIComponent(
      providerServiceId
    )}`,
    {
      method: 'PUT',
      body: payload,
      auth: true
    }
  )
}

export async function getProviderBookings() {
  const result = await request('/providers/me/bookings', {
    auth: true
  })

  return resultArray(result)
}

export function updateProviderBookingStatus(
  bookingId,
  status
) {
  return request(
    `/providers/me/bookings/${encodeURIComponent(
      bookingId
    )}/status`,
    {
      method: 'PUT',
      body: { status },
      auth: true
    }
  )
}

// ---------- Reviews ----------

export async function getPublicReviews() {
  const result = await request('/reviews')
  return resultArray(result)
}

export function createReview(payload) {
  return request('/reviews', {
    method: 'POST',
    body: payload
  })
}

export async function getProviderReviews(providerId) {
  const result = await request(
    `/reviews/provider/${encodeURIComponent(providerId)}`
  )

  return resultArray(result)
}

// ---------- Administration ----------

export async function getAllCustomersAdmin(
  page = 1,
  limit = 100
) {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(limit)
  })

  const result = await request(
    `/admins/customers?${query.toString()}`,
    {
      auth: true
    }
  )

  return resultArray(result)
}

export async function getAllProvidersAdmin(
  page = 1,
  limit = 100
) {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(limit)
  })

  const result = await request(
    `/admins/providers?${query.toString()}`,
    {
      auth: true
    }
  )

  return resultArray(result)
}

export function verifyProvider(providerId) {
  return request(
    `/admins/providers/${encodeURIComponent(
      providerId
    )}/verify`,
    {
      method: 'POST',
      auth: true
    }
  )
}

export function suspendUser(userType, id, reason) {
  return request(
    `/admins/users/${encodeURIComponent(
      userType
    )}/${encodeURIComponent(id)}/suspend`,
    {
      method: 'POST',
      body: { reason },
      auth: true
    }
  )
}

export function activateUser(userType, id) {
  return request(
    `/admins/users/${encodeURIComponent(
      userType
    )}/${encodeURIComponent(id)}/activate`,
    {
      method: 'POST',
      auth: true
    }
  )
}

// ---------- Reports and safety ----------

export function createReport(payload) {
  return request('/reports', {
    method: 'POST',
    body: payload,
    auth: true
  })
}

export async function getAllReportsAdmin() {
  const result = await request('/reports', {
    auth: true
  })

  return resultArray(result)
}

export function updateReportStatus(id, status) {
  return request(
    `/reports/${encodeURIComponent(id)}/status`,
    {
      method: 'PUT',
      body: { status },
      auth: true
    }
  )
}

// ---------- Chat approval ----------

export async function getChatApprovals() {
  const result = await request('/chat/approvals', {
    auth: true
  })

  return resultArray(result)
}

export function requestChatApproval(payload) {
  return request('/chat/approvals', {
    method: 'POST',
    body: payload,
    auth: true
  })
}

export function updateChatApproval(
  approvalId,
  status
) {
  return request(
    `/chat/approvals/${encodeURIComponent(
      approvalId
    )}`,
    {
      method: 'PATCH',
      body: { status },
      auth: true
    }
  )
}

// ---------- Chat messages ----------

export async function getChatMessages(bookingId) {
  const query = bookingId
    ? `?${new URLSearchParams({
      bookingId: String(bookingId)
    }).toString()}`
    : ''

  const result = await request(
    `/chat/messages${query}`,
    {
      auth: true
    }
  )

  return resultArray(result)
}

export function sendChatMessage(payload) {
  return request('/chat/messages', {
    method: 'POST',
    body: payload,
    auth: true
  })
}

// ---------- AI chatbot ----------

export function sendChatbotMessage(
  message,
  history = []
) {
  return request('/chatbot/message', {
    method: 'POST',
    body: {
      message,
      history
    }
  })
}