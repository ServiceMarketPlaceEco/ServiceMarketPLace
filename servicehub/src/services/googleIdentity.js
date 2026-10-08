// Loads Google Identity Services (the "Sign in with Google" button) once.
// The button returns an ID token which the backend verifies at /auth/google.

const GIS_SRC = 'https://accounts.google.com/gsi/client'

let loading = null

export function getGoogleClientId() {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
}

export function loadGoogleIdentity() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google)
  if (loading) return loading

  loading = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GIS_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve(window.google)
    script.onerror = () => {
      loading = null
      script.remove()
      reject(new Error('Could not load Google sign-in.'))
    }
    document.head.appendChild(script)
  })

  return loading
}
