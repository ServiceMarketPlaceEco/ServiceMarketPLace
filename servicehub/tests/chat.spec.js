// Customer <-> provider chat, driven through the real UI against a small fake
// backend that remembers approvals and messages between requests.
import { test, expect } from '@playwright/test'

const CUSTOMER_LOGIN = {
  accessToken: 'fake-access', refreshToken: 'fake-refresh', userType: 'customer',
  user: { customerId: 'cust-1', name: 'Test Customer', email: 'test@servicehub.local', phone: '01700000000', address: 'Boalia' }
}
const PROVIDER_LOGIN = {
  accessToken: 'fake-provider-access', refreshToken: 'fake-provider-refresh', userType: 'provider',
  user: { providerId: 'prov-1', providerName: 'Rajshahi Cleaners', email: 'provider@servicehub.local', phone: '01800000000', address: 'Boalia', isVerified: true }
}
const ADMIN_LOGIN = {
  accessToken: 'fake-admin-access', refreshToken: 'fake-admin-refresh', userType: 'admin',
  user: { id: 'admin-1', name: 'Test Admin', email: 'admin@servicehub.local' }
}

const BOOKING = {
  bookingId: 'BK-1001', customerId: 'cust-1', providerServiceId: 'ps-1', status: 'confirmed',
  serviceName: 'Home Cleaning', address: 'Boalia, Rajshahi', date: '2026-11-10', totalAmount: 500,
  customer: { name: 'Test Customer', address: 'Boalia', phone: '01700000000' },
  providerService: { providerId: 'prov-1', provider: { providerName: 'Rajshahi Cleaners', phone: '01800000000' } }
}

// Wires up a fake backend. `state` is shared so a test can change it (e.g. the
// admin approving) and the app sees the change on its next request.
async function fakeBackend(page, login, state) {
  await page.route('**/api/services', route => route.fulfill({ json: [] }))
  await page.route('**/api/reviews**', route => route.fulfill({ json: [] }))
  await page.route('**/api/auth/login', route => route.fulfill({ json: login }))
  await page.route('**/api/bookings/my-bookings', route => route.fulfill({ json: [BOOKING] }))
  await page.route('**/api/bookings', route => route.fulfill({ json: [BOOKING] }))
  await page.route('**/api/providers/me/bookings', route => route.fulfill({ json: [BOOKING] }))
  await page.route('**/api/providers/me/services**', route => route.fulfill({ json: [] }))
  await page.route('**/api/admins/**', route => route.fulfill({ json: { data: [], total: 0 } }))
  await page.route('**/api/reports**', route => route.fulfill({ json: [] }))

  const approvalView = () => state.approval && {
    ...state.approval, bookingId: BOOKING.bookingId, serviceName: 'Home Cleaning',
    customerName: 'Test Customer', providerName: 'Rajshahi Cleaners'
  }

  await page.route('**/api/chat/approvals**', async route => {
    const req = route.request()
    if (req.method() === 'GET') return route.fulfill({ json: state.approval ? [approvalView()] : [] })
    if (req.method() === 'POST') {
      state.approval = { id: 'ap-1', requestedBy: login.userType, status: 'pending' }
      return route.fulfill({ status: 201, json: approvalView() })
    }
    // PATCH from the admin dashboard
    state.approval.status = req.postDataJSON().status
    return route.fulfill({ json: approvalView() })
  })

  await page.route('**/api/chat/messages**', async route => {
    const req = route.request()
    if (req.method() === 'GET') return route.fulfill({ json: state.messages })
    const body = req.postDataJSON()
    const saved = { id: `m-${state.messages.length + 1}`, bookingId: body.bookingId, senderType: login.userType, message: body.message, createdAt: new Date().toISOString() }
    state.sent.push(body)
    state.messages.push(saved)
    return route.fulfill({ status: 201, json: saved })
  })
}

async function signInAs(page, identifier) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.getByPlaceholder(/amy01/i).fill(identifier)
  await page.getByPlaceholder('Enter your password').fill('Password@123')
  await page.getByRole('button', { name: 'Sign in securely' }).click()
}

test('a customer asks to chat and waits for an admin', async ({ page }) => {
  const state = { approval: null, messages: [], sent: [] }
  await fakeBackend(page, CUSTOMER_LOGIN, state)
  await signInAs(page, 'test@servicehub.local')

  await page.getByRole('button', { name: 'Chat', exact: true }).click()
  await expect(page.getByText('Chat with Rajshahi Cleaners')).toBeVisible()

  await page.getByRole('button', { name: 'Ask to chat' }).click()
  await expect(page.getByText(/waiting for an admin/i)).toBeVisible()
  expect(state.approval).toMatchObject({ status: 'pending', requestedBy: 'customer' })
})

test('once approved, the customer and provider can message each other', async ({ page }) => {
  const state = { approval: { id: 'ap-1', requestedBy: 'customer', status: 'approved' }, messages: [], sent: [] }
  await fakeBackend(page, CUSTOMER_LOGIN, state)
  await signInAs(page, 'test@servicehub.local')

  await page.getByRole('button', { name: 'Open chat' }).click()
  await page.getByRole('textbox', { name: 'Message' }).fill('Can you come at 10?')
  await page.keyboard.press('Enter')

  await expect(page.locator('.chat-bubble-row.mine')).toContainText('Can you come at 10?')
  // only the booking and the text are sent; the backend decides who sent it
  expect(state.sent).toEqual([{ bookingId: 'BK-1001', message: 'Can you come at 10?' }])

  // the provider replies (as if from their own dashboard); the customer's
  // open panel picks it up on its next poll
  state.messages.push({ id: 'm-2', bookingId: 'BK-1001', senderType: 'provider', message: 'Yes, see you then', createdAt: new Date().toISOString() })
  await expect(page.locator('.chat-bubble-row:not(.mine)')).toContainText('Yes, see you then', { timeout: 8000 })
})

test('the provider sees their customer chats in Messages', async ({ page }) => {
  const state = {
    approval: { id: 'ap-1', requestedBy: 'customer', status: 'approved' },
    messages: [{ id: 'm-1', bookingId: 'BK-1001', senderType: 'customer', message: 'Can you come at 10?', createdAt: new Date().toISOString() }],
    sent: []
  }
  await fakeBackend(page, PROVIDER_LOGIN, state)
  await signInAs(page, 'provider@servicehub.local')

  await page.getByRole('button', { name: 'Messages' }).click()
  await expect(page.getByText('Chat with Test Customer')).toBeVisible()
  await expect(page.locator('.chat-bubble-row:not(.mine)')).toContainText('Can you come at 10?')

  // the Messages page also has the chat with the admin team, so stay inside
  // the customer chat panel
  const chat = page.locator('.chat-panel')
  await chat.getByRole('textbox', { name: 'Message' }).fill('Yes, see you then')
  await chat.getByRole('button', { name: 'Send' }).click()
  await expect(page.locator('.chat-bubble-row.mine')).toContainText('Yes, see you then')
})

test('an admin approves a chat request', async ({ page }) => {
  const state = { approval: { id: 'ap-1', requestedBy: 'provider', status: 'pending' }, messages: [], sent: [] }
  await fakeBackend(page, ADMIN_LOGIN, state)
  await signInAs(page, 'admin@servicehub.local')

  await page.getByRole('button', { name: 'Chat approvals' }).click()
  const row = page.locator('tr', { hasText: 'Home Cleaning' })
  await expect(row).toContainText('Test Customer')
  await expect(row).toContainText('Rajshahi Cleaners')

  await row.getByRole('button', { name: 'Approve' }).click()
  await expect(row.locator('.status-pill')).toHaveText('approved')
  await expect(row.getByRole('button', { name: 'Approve' })).toHaveCount(0)
  await expect(row.getByRole('button', { name: 'Close chat' })).toBeVisible()
})
