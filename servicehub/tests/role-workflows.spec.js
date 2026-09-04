import { test, expect } from '@playwright/test'

const services = [{ serviceId: 's1', serviceName: 'Home Cleaning', description: 'Home help', isActive: true }]

async function prepareApi(page, role) {
  const user = role === 'customer'
    ? { customerId: 'c1', name: 'Test Customer', email: 'customer@test.com', address: 'Boalia' }
    : role === 'provider'
      ? { providerId: 'p1', providerName: 'Test Provider', email: 'provider@test.com' }
      : { id: 'a1', name: 'Test Admin', email: 'admin@test.com', role: 'admin' }

  await page.route('**/api/**', async route => {
    const url = route.request().url()
    if (url.endsWith('/auth/login')) return route.fulfill({ json: { accessToken: 'access', refreshToken: 'refresh', userType: role, user } })
    if (url.endsWith('/services')) return route.fulfill({ json: services })
    if (url.includes('/services/') && url.endsWith('/providers')) return route.fulfill({ json: [] })
    if (url.includes('/admins/customers')) return route.fulfill({ json: { data: [] } })
    if (url.includes('/admins/providers')) return route.fulfill({ json: { data: [] } })
    return route.fulfill({ json: [] })
  })
}

async function signIn(page, role, email) {
  await prepareApi(page, role)
  await page.goto('/')
  await page.getByRole('button', { name: 'Sign in' }).first().click()
  await page.locator('.auth-card select').selectOption(role)
  await page.getByPlaceholder(/admin01/i).fill(email)
  await page.getByPlaceholder('Enter password').fill('Password@123')
  await page.locator('.auth-card').getByRole('button', { name: 'Sign in' }).click()
}

test('customer signs in, sees bookings and can return to services', async ({ page }) => {
  await signIn(page, 'customer', 'customer@test.com')
  await expect(page.getByRole('heading', { name: /welcome, test customer/i })).toBeVisible()
  await expect(page.getByText('No service requests yet.')).toBeVisible()
  await page.getByRole('button', { name: 'Request another service' }).click()
  await expect(page.getByText('Home Cleaning').first()).toBeVisible()
})

test('provider signs in and opens each main workspace area', async ({ page }) => {
  await signIn(page, 'provider', 'provider@test.com')
  await expect(page.getByRole('heading', { name: 'Provider dashboard' })).toBeVisible()
  for (const name of ['My services', 'Requests', 'Messages', 'Reviews', 'Settings']) {
    await page.getByRole('button', { name, exact: true }).click()
    await expect(page.locator('.ops-topbar h1')).toContainText(new RegExp(name.replace('My services', 'services'), 'i'))
  }
})

test('admin signs in and opens user and provider management', async ({ page }) => {
  await signIn(page, 'admin', 'admin@test.com')
  await expect(page.getByRole('heading', { name: 'Admin dashboard' })).toBeVisible()
  await page.getByRole('button', { name: 'Users', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'User management' })).toBeVisible()
  await page.getByRole('button', { name: 'Service providers', exact: true }).click()
  await expect(page.locator('.ops-topbar h1')).toContainText('providers')
})
