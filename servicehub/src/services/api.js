import axios from 'axios'

// API base URL - change this for production
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Token management
const TOKEN_KEY = 'servicehub-access-token'
const REFRESH_TOKEN_KEY = 'servicehub-refresh-token'
const USER_KEY = 'servicehub-user'

export const tokenService = {
  getAccessToken: () => localStorage.getItem(TOKEN_KEY),
  getRefreshToken: () => localStorage.getItem(REFRESH_TOKEN_KEY),
  getUser: () => JSON.parse(localStorage.getItem(USER_KEY) || 'null'),
  
  setTokens: (accessToken, refreshToken, user) => {
    localStorage.setItem(TOKEN_KEY, accessToken)
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  },
  
  clearTokens: () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  }
}

// Request interceptor - add auth token to requests
api.interceptors.request.use(
  (config) => {
    const token = tokenService.getAccessToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor - handle 401 errors and token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    
    // If 401 and not already retrying, try to refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      
      try {
        const refreshToken = tokenService.getRefreshToken()
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken
          })
          
          const { accessToken, refreshToken: newRefreshToken } = response.data
          const user = tokenService.getUser()
          tokenService.setTokens(accessToken, newRefreshToken, user)
          
          originalRequest.headers.Authorization = `Bearer ${accessToken}`
          return api(originalRequest)
        }
      } catch (refreshError) {
        tokenService.clearTokens()
        window.location.href = '/'
      }
    }
    
    return Promise.reject(error)
  }
)

// Auth API
export const authApi = {
  // Customer registration
  registerCustomer: async (data) => {
    const response = await api.post('/auth/register/customer', {
      name: data.name,
      email: data.email,
      password: data.password,
      phone: data.phone || null,
      address: data.area || null
    })
    return response.data
  },
  
  // Customer login
  loginCustomer: async (email, password) => {
    const response = await api.post('/auth/login', { email, password, userType: 'customer' })
    return response.data
  },
  
  // Provider login
  loginProvider: async (email, password) => {
    const response = await api.post('/auth/login', { email, password, userType: 'provider' })
    return response.data
  },
  
  // Admin login
  loginAdmin: async (email, password) => {
    const response = await api.post('/auth/login', { email, password, userType: 'admin' })
    return response.data
  },
  
  // Logout
  logout: async () => {
    try {
      const refreshToken = tokenService.getRefreshToken()
      if (refreshToken) {
        await api.post('/auth/logout', { refreshToken })
      }
    } finally {
      tokenService.clearTokens()
    }
  },
  
  // Get current user profile
  getProfile: async () => {
    const response = await api.get('/customers/profile')
    return response.data
  }
}

// Bookings API
export const bookingsApi = {
  // Create a new booking
  create: async (data) => {
    const response = await api.post('/bookings', data)
    return response.data
  },
  
  // Get customer's bookings
  getMyBookings: async () => {
    const response = await api.get('/bookings/my-bookings')
    return response.data
  },
  
  // Get single booking
  getById: async (id) => {
    const response = await api.get(`/bookings/${id}`)
    return response.data
  },
  
  // Cancel booking
  cancel: async (id) => {
    const response = await api.patch(`/bookings/${id}/cancel`)
    return response.data
  }
}

// Reviews API
export const reviewsApi = {
  // Create a review
  create: async (data) => {
    const response = await api.post('/reviews', data)
    return response.data
  },
  
  // Get reviews for a provider
  getByProvider: async (providerId) => {
    const response = await api.get(`/reviews/provider/${providerId}`)
    return response.data
  },
  
  // Get my reviews
  getMyReviews: async () => {
    const response = await api.get('/reviews/my-reviews')
    return response.data
  }
}

// Reports API (Block/Report)
export const reportsApi = {
  // Create a block report
  create: async (data) => {
    const response = await api.post('/reports', data)
    return response.data
  },
  
  // Get my reports
  getMyReports: async () => {
    const response = await api.get('/reports/my-reports')
    return response.data
  }
}

// Services API
export const servicesApi = {
  // Get all services
  getAll: async () => {
    const response = await api.get('/services')
    return response.data
  },
  
  // Get service by ID
  getById: async (id) => {
    const response = await api.get(`/services/${id}`)
    return response.data
  }
}

// Providers API
export const providersApi = {
  // Get all providers
  getAll: async () => {
    const response = await api.get('/providers')
    return response.data
  },
  
  // Get provider by ID
  getById: async (id) => {
    const response = await api.get(`/providers/${id}`)
    return response.data
  },
  
  // Get providers by service
  getByService: async (serviceId) => {
    const response = await api.get(`/providers/by-service/${serviceId}`)
    return response.data
  }
}

export default api
