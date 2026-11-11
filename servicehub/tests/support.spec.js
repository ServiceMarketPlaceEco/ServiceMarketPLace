// Messages between the admin team and a customer, and the customer Settings
// tab, driven through the real UI against a small fake backend.
import { test, expect } from '@playwright/test'

const CUSTOMER_LOGIN = {
  accessToken: 'fake-access', refreshToken: 'fake-refresh', userType: 'customer',
  user: { customerId: 'cust-1', name: 'Test Customer', email: 'test@servicehub.local', phone: '01700000000', address: 'Boalia' }
}
const ADMIN_LOGIN = {
  accessToken: 'fake-admin-access', refreshToken: 'fake-admin-refresh', userType: 'admin',
  user: { id: 'admin-1', name: 'Test Admin', email: 'admin@servicehub.local' }
}

// `state` is shared so a test can see what the app sent.
async function fakeBackend(page, login, state) {
  await page.route('**/api/services', route => route.fulfill({ json: [] }))
  await page.route('**/api/reviews**', route => route.fulfill({ json: [] }))
  await page.route('**/api/auth/login', route => route.fulfill({ json: login }))
  await page.route('**/api/auth/logout', route => route.fulfill({ json: {} }))
  await page.route('**/api/bookings**', route => route.fulfill({ json: [] }))
  await page.route('**/api/chat/**', route => route.fulfill({ json: [] }))
  await page.route('**/api/admins/**', route => route.fulfill({ json: { data: [], total: 0 } }))
  await page.route('**/api/reports**', route => route.fulfill({ json: [] }))

  const unreadFor = who => state.messages.filter(m => (who === 'admin' ? m.senderType !== 'admin' : m.senderType === 'admin') && !m.read).length
  const save = (senderType, senderName, message) => {
    const saved = { id: `m-${state.messages.length + 1}`, senderType, senderName, message, createdAt: new Date().toISOString() }
    state.messages.push(saved)
    return saved
  }

  await page.route('**/api/support/unread', route =>
    route.fulfill({ json: { unread: unreadFor(login.userType === 'admin' ? 'admin' : 'user') } }))

  // the customer's own conversation
  await page.route('**/api/support/messages', route => {
    const req = route.request()
    if (req.method() === 'GET') {
      state.messages.forEach(m => { if (m.senderType === 'admin') m.read = true })
      return route.fulfill({ json: state.messages })
    }
    return route.fulfill({ status: 201, json: save('customer', 'Test Customer', req.postDataJSON().message) })
  })

  // the admin inbox
  await page.route('**/api/support/threads', route => route.fulfill({
    json: state.messages.length
      ? [{ userType: 'customer', userId: 'cust-1', userName: 'Test Customer', lastMessage: state.messages.at(-1), lastMessageAt: state.messages.at(-1).createdAt, unread: unreadFor('admin') }]
      : []
  }))
  await page.route('**/api/support/threads/customer/cust-1/messages', route => {
    const req = route.request()
    if (req.method() === 'GET') {
      state.messages.forEach(m => { if (m.senderType !== 'admin') m.read = true })
      return route.fulfill({ json: state.messages })
    }
    return route.fulfill({ status: 201, json: save('admin', 'Test Admin', req.postDataJSON().message) })
  })

  await page.route('**/api/customers/profile', route => {
    state.profile = route.request().postDataJSON()
    return route.fulfill({ json: { ...CUSTOMER_LOGIN.user, ...state.profile } })
  })
  await page.route('**/api/customers/account', route => {
    state.closedWith = route.request().postDataJSON()
    return route.fulfill({ json: { message: 'Account closed' } })
  })
}

async function signInAs(page, identifier) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.getByPlaceholder(/amy01/i).fill(identifier)
  await page.getByPlaceholder('Enter your password').fill('Password@123')
  await page.getByRole('button', { name: 'Sign in securely' }).click()
}

test('a customer writes to the admin team', async ({ page }) => {
  const state = { messages: [] }
  await fakeBackend(page, CUSTOMER_LOGIN, state)
  await signInAs(page, 'test@servicehub.local')

  await page.getByRole('button', { name: /Message admin/ }).click()
  await expect(page.getByText('No messages yet')).toBeVisible()

  await page.getByPlaceholder('Message the admin team').fill('Can I move my booking to Saturday?')
  await page.getByRole('button', { name: 'Send' }).click()

  await expect(page.locator('.support-row.mine')).toContainText('Can I move my booking to Saturday?')
  expect(state.messages).toHaveLength(1)
})

test('a customer sees a badge for an admin reply and it clears when read', async ({ page }) => {
  const state = { messages: [{ id: 'm-1', senderType: 'admin', senderName: 'Test Admin', message: 'Your provider is on the way.', createdAt: new Date().toISOString() }] }
  await fakeBackend(page, CUSTOMER_LOGIN, state)
  await signInAs(page, 'test@servicehub.local')

  const tab = page.getByRole('button', { name: /Message admin/ })
  await expect(tab.locator('.tab-badge')).toHaveText('1')

  await tab.click()
  await expect(page.getByText('Your provider is on the way.')).toBeVisible()
  await expect(tab.locator('.tab-badge')).toHaveCount(0)
})

test('an admin opens a conversation from the inbox and replies', async ({ page }) => {
  const state = { messages: [{ id: 'm-1', senderType: 'customer', senderName: 'Test Customer', message: 'Is my request assigned yet?', createdAt: new Date().toISOString() }] }
  await fakeBackend(page, ADMIN_LOGIN, state)
  await signInAs(page, 'admin@servicehub.local')

  await page.getByRole('button', { name: /^Messages/ }).click()
  const conversation = page.locator('.inbox-list button', { hasText: 'Test Customer' })
  await expect(conversation.locator('.tab-badge')).toHaveText('1')

  await conversation.click()
  await expect(page.getByText('Is my request assigned yet?').last()).toBeVisible()

  await page.getByPlaceholder('Message Test Customer').fill('Yes, Rajshahi Cleaners will come at 10.')
  await page.getByRole('button', { name: 'Send' }).click()

  await expect(page.locator('.inbox-row.mine')).toContainText('Rajshahi Cleaners will come at 10.')
  expect(state.messages.at(-1)).toMatchObject({ senderType: 'admin' })
})

test('a customer updates their details in Settings', async ({ page }) => {
  const state = { messages: [] }
  await fakeBackend(page, CUSTOMER_LOGIN, state)
  await signInAs(page, 'test@servicehub.local')

  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByLabel('Address or area').fill('Kazla, Rajshahi')
  await page.getByRole('button', { name: 'Save details' }).click()

  await expect(page.getByText('Your details are saved')).toBeVisible()
  expect(state.profile).toMatchObject({ name: 'Test Customer', address: 'Kazla, Rajshahi' })
})

test('a customer closes their account with their password and is signed out', async ({ page }) => {
  const state = { messages: [] }
  await fakeBackend(page, CUSTOMER_LOGIN, state)
  await signInAs(page, 'test@servicehub.local')

  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('button', { name: 'Close my account' }).click()
  await page.getByLabel('Enter your password to confirm').fill('Password@123')
  await page.locator('.danger-zone form button[type="submit"]').click()

  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible()
  expect(state.closedWith).toEqual({ password: 'Password@123' })
})
