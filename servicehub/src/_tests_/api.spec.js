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
})
