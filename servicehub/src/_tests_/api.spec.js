import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../services/api'

const response = (body, ok = true, status = 200) => ({ ok, status, text: vi.fn().mockResolvedValue(body === null ? '' : JSON.stringify(body)) })

describe('API service', () => {
  beforeEach(() => {
    localStorage.clear()
    global.fetch = vi.fn()
  })

  it('saves and clears both sign in tokens', () => {
    api.setTokens('access', 'refresh')
    expect(api.getAccessToken()).toBe('access')
    expect(api.getRefreshToken()).toBe('refresh')
    api.clearTokens()
    expect(api.getAccessToken()).toBeNull()
  })

  it('sends customer registration as JSON', async () => {
    fetch.mockResolvedValue(response({ customerId: 'c1' }))
    await api.registerCustomer({ name: 'Jess' })
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/auth/register/customer'), expect.objectContaining({ method: 'POST', body: JSON.stringify({ name: 'Jess' }) }))
  })

  it('adds the access token to protected requests', async () => {
    localStorage.setItem('servicehub-access-token', 'token123')
    fetch.mockResolvedValue(response([]))
    await api.getMyBookings()
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer token123')
  })

  it('does not add authorization to a public request', async () => {
    fetch.mockResolvedValue(response([]))
    await api.getServices()
    expect(fetch.mock.calls[0][1].headers.Authorization).toBeUndefined()
  })

  it('shows the backend error message', async () => {
    fetch.mockResolvedValue(response({ message: 'Invalid details' }, false, 400))
    await expect(api.login({})).rejects.toThrow('Invalid details')
  })

  it('joins more than one validation error', async () => {
    fetch.mockResolvedValue(response({ message: ['Email is invalid', 'Password is weak'] }, false, 400))
    await expect(api.registerCustomer({})).rejects.toThrow('Email is invalid, Password is weak')
  })

  it('handles a successful empty response', async () => {
    fetch.mockResolvedValue(response(null))
    await expect(api.activateUser('customer', 'c1')).resolves.toBeNull()
  })
  // the admin dashboard used to call public booking endpoints, so these
  // check the admin's token now goes with both requests
  it('sends the admin token when loading every booking', async () => {
    localStorage.setItem('servicehub-access-token', 'admin-token')
    fetch.mockResolvedValue(response([]))
    await api.getAllBookings()
    expect(fetch.mock.calls[0][0]).toMatch(/\/bookings$/)
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer admin-token')
  })

  it('sends the admin token when assigning a provider to a booking', async () => {
    localStorage.setItem('servicehub-access-token', 'admin-token')
    fetch.mockResolvedValue(response({ bookingId: 'b1' }))
    await api.updateBookingStatus('b1', 'confirmed', 'p1')
    const [url, options] = fetch.mock.calls[0]
    expect(url).toContain('/bookings/b1/status')
    expect(options.method).toBe('PATCH')
    expect(options.headers.Authorization).toBe('Bearer admin-token')
    expect(JSON.parse(options.body)).toEqual({ status: 'confirmed', providerId: 'p1' })
  })
})
