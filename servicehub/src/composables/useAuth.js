import { ref, computed } from 'vue'
import { authApi, tokenService } from '../services/api.js'

// Global reactive state
const currentUser = ref(null)
const isLoading = ref(false)
const error = ref(null)

// Initialize from localStorage on module load
const storedUser = tokenService.getUser()
if (storedUser) {
  currentUser.value = storedUser
}

export function useAuth() {
  const isAuthenticated = computed(() => !!currentUser.value)
  const userRole = computed(() => currentUser.value?.userType || currentUser.value?.role || 'customer')
  const userName = computed(() => currentUser.value?.name || 'Guest')

  // Register customer
  async function registerCustomer(formData) {
    isLoading.value = true
    error.value = null
    
    try {
      const response = await authApi.registerCustomer(formData)
      
      // Store tokens and user
      tokenService.setTokens(
        response.accessToken,
        response.refreshToken,
        { ...response.user, userType: response.userType }
      )
      
      currentUser.value = { ...response.user, userType: response.userType }
      
      return { success: true, user: currentUser.value }
    } catch (err) {
      const message = err.response?.data?.message || 'Registration failed. Please try again.'
      error.value = message
      return { success: false, error: message }
    } finally {
      isLoading.value = false
    }
  }

  // Login customer
  async function loginCustomer(email, password) {
    isLoading.value = true
    error.value = null
    
    try {
      const response = await authApi.loginCustomer(email, password)
      
      tokenService.setTokens(
        response.accessToken,
        response.refreshToken,
        { ...response.user, userType: response.userType }
      )
      
      currentUser.value = { ...response.user, userType: response.userType }
      
      return { success: true, user: currentUser.value }
    } catch (err) {
      const message = err.response?.data?.message || 'Login failed. Please check your credentials.'
      error.value = message
      return { success: false, error: message }
    } finally {
      isLoading.value = false
    }
  }

  // Login admin
  async function loginAdmin(email, password) {
    isLoading.value = true
    error.value = null
    
    try {
      const response = await authApi.loginAdmin(email, password)
      
      tokenService.setTokens(
        response.accessToken,
        response.refreshToken,
        { ...response.user, userType: 'admin', role: 'admin' }
      )
      
      currentUser.value = { ...response.user, userType: 'admin', role: 'admin' }
      
      return { success: true, user: currentUser.value }
    } catch (err) {
      const message = err.response?.data?.message || 'Admin login failed.'
      error.value = message
      return { success: false, error: message }
    } finally {
      isLoading.value = false
    }
  }

  // Login provider
  async function loginProvider(email, password) {
    isLoading.value = true
    error.value = null
    
    try {
      const response = await authApi.loginProvider(email, password)
      
      tokenService.setTokens(
        response.accessToken,
        response.refreshToken,
        { ...response.user, userType: 'provider' }
      )
      
      currentUser.value = { ...response.user, userType: 'provider' }
      
      return { success: true, user: currentUser.value }
    } catch (err) {
      const message = err.response?.data?.message || 'Provider login failed.'
      error.value = message
      return { success: false, error: message }
    } finally {
      isLoading.value = false
    }
  }

  // Logout
  async function logout() {
    try {
      await authApi.logout()
    } catch (err) {
      console.error('Logout error:', err)
    } finally {
      currentUser.value = null
      tokenService.clearTokens()
    }
  }

  // Check if user is still authenticated (on app mount)
  async function checkAuth() {
    const token = tokenService.getAccessToken()
    const user = tokenService.getUser()
    
    if (token && user) {
      currentUser.value = user
      return true
    }
    
    return false
  }

  return {
    // State
    currentUser,
    isLoading,
    error,
    
    // Computed
    isAuthenticated,
    userRole,
    userName,
    
    // Methods
    registerCustomer,
    loginCustomer,
    loginAdmin,
    loginProvider,
    logout,
    checkAuth
  }
}
