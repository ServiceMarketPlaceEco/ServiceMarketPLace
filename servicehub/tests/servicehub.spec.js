

import { test, expect } from '@playwright/test'

const MOCK_SERVICES = [
  { serviceId: 's-1', serviceName: 'Home Cleaning', icon: 'home', description: 'Regular and deep home cleaning', isActive: true },
  { serviceId: 's-2', serviceName: 'AC Repair', icon: 'thermometer', description: 'AC servicing and repair', isActive: true },
  { serviceId: 's-3', serviceName: 'Electrician', icon: 'zap', description: 'Electrical work', isActive: true }
]

const MOCK_PROVIDERS = [
  {
    providerServiceId: 'ps-1',
    providerId: 'prov-1',
    providerName: 'Rajshahi Cleaners',
    price: 500,
    rating: 4.5,
    totalReviews: 12,
    isVerified: true
  }
]

const MOCK_CUSTOMER_LOGIN = {
  accessToken: 'fake-access',
  refreshToken: 'fake-refresh',
  userType: 'customer',
  user: {
    customerId: 'cust-1',
    name: 'Test Customer',
    email: 'test@servicehub.local',
    phone: '01700000000',
    address: 'Boalia'
  }
}

// What the backend sends back when an admin signs in. userType is the bit the app reads to decide which dashboard to show.
const MOCK_ADMIN_LOGIN = {
  accessToken: 'fake-admin-access',
  refreshToken: 'fake-admin-refresh',
  userType: 'admin',
  user: {
    id: 'admin-1',
    name: 'Test Admin',
    email: 'admin@servicehub.local'
  }
}

const MOCK_PROVIDER_LOGIN = {
  accessToken: 'fake-provider-access',
  refreshToken: 'fake-provider-refresh',
  userType: 'provider',
  user: {
    providerId: 'prov-1',
    providerName: 'Rajshahi Cleaners',
    email: 'provider@servicehub.local',
    phone: '01800000000',
    address: 'Boalia',
    isVerified: true
  }
}

// A booking as the backend returns it, used by the tracking tests.
const TRACKED_BOOKING = {
  bookingId: 'BK-1001',
  customerId: 'cust-1',
  status: 'in_progress',
  serviceName: 'Home Cleaning',
  address: 'Boalia, Rajshahi',
  date: '2026-10-30',
  totalAmount: 500,
  customer: { name: 'Test Customer', address: 'Boalia', phone: '01700000000' },
  providerService: { providerId: 'prov-1', provider: { providerName: 'Rajshahi Cleaners', phone: '01800000000' } }
}

async function mockAdminApi(page) {
  await page.route('**/api/admins/customers**', route =>
    route.fulfill({ json: { data: [], total: 0 } })
  )
  await page.route('**/api/admins/providers**', route =>
    route.fulfill({ json: { data: [], total: 0 } })
  )
  await page.route('**/api/reports**', route => route.fulfill({ json: [] }))
}

// Same idea for the provider dashboard.
async function mockProviderApi(page) {
  await page.route('**/api/providers/me/services**', route => route.fulfill({ json: [] }))
  await page.route('**/api/reviews/provider/**', route => route.fulfill({ json: [] }))
}

// Signs in through the real form rather than faking a session.
// There is no account type dropdown: the backend works out the role from the email.
async function signInAs(page, identifier, password = 'Password@123') {
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.getByPlaceholder(/amy01/i).fill(identifier)
  await page.getByPlaceholder('Enter your password').fill(password)
  await page.getByRole('button', { name: 'Sign in securely' }).click()
}

// Opens the customer register page from the guest navbar.
async function openRegister(page) {
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.getByRole('button', { name: 'Create a customer account' }).click()
}

// wires up the mocked api before the page loads
async function mockApi(page) {
  await page.route('**/api/services', route =>
    route.fulfill({ json: MOCK_SERVICES })
  )
  await page.route('**/api/services/*/providers', route =>
    route.fulfill({ json: MOCK_PROVIDERS })
  )
  await page.route('**/api/auth/login', route =>
    route.fulfill({ json: MOCK_CUSTOMER_LOGIN })
  )
  await page.route('**/api/auth/register/customer', route =>
    route.fulfill({ json: MOCK_CUSTOMER_LOGIN })
  )
  await page.route('**/api/bookings/**', route => route.fulfill({ json: [] }))
  await page.route('**/api/bookings', route => route.fulfill({ json: [] }))
}

test.beforeEach(async ({ page }) => {
  await mockApi(page)
  await page.goto('/')
})



test('1. homepage loads with the ServiceHub brand in the navbar', async ({ page }) => {
  await expect(page.locator('.brand-logo')).toContainText('ServiceHub')
})

test('2. hero heading is visible on the homepage', async ({ page }) => {
  await expect(
    page.getByRole('heading', { name: /book trusted local help/i })
  ).toBeVisible()
})

test('3. hero mentions the Rajshahi marketplace', async ({ page }) => {
  await expect(page.locator('.eyebrow').first()).toContainText(/rajshahi/i)
})

test('4. guest navbar shows How it works, Reviews, Become a provider and Sign in', async ({ page }) => {
  const nav = page.locator('.nav-links')
  await expect(nav.getByRole('button', { name: 'How it works' })).toBeVisible()
  await expect(nav.getByRole('button', { name: 'Reviews' })).toBeVisible()
  await expect(nav.getByRole('button', { name: 'Become a provider' })).toBeVisible()
  // Sign in sits beside the theme button, not in the main links.
  await expect(page.locator('.nav-actions').getByRole('button', { name: 'Sign in' })).toBeVisible()
})

test('5. guest navbar does not show signed-in links', async ({ page }) => {
  const nav = page.locator('.nav-links')
  await expect(nav.getByRole('button', { name: 'Home' })).toHaveCount(0)
  await expect(nav.getByRole('button', { name: 'Services' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Log out' })).toHaveCount(0)
})

test('6. hero has the Get started and How it works buttons', async ({ page }) => {
  const hero = page.locator('.hero, section').first()
  await expect(page.getByRole('button', { name: 'Get started' })).toBeVisible()
  await expect(hero.getByRole('button', { name: 'How it works' })).toBeVisible()
})

test('7. a customer can track a booking from the dashboard', async ({ page }) => {
  await page.route('**/api/bookings/my-bookings', route => route.fulfill({ json: [TRACKED_BOOKING] }))
  await signInAs(page, 'test@servicehub.local')

  await page.getByRole('button', { name: 'Track' }).first().click()

  await expect(page.getByRole('heading', { name: 'Track your booking' })).toBeVisible()
  // in_progress from the backend shows as the third stage with its own message.
  await expect(page.locator('.current-update')).toContainText('Your provider has started the service.')
  await expect(page.locator('.tracking-timeline')).toContainText('Service in progress')
})

test('8. a cancelled booking shows the cancelled state instead of a stage', async ({ page }) => {
  await page.route('**/api/bookings/my-bookings', route =>
    route.fulfill({ json: [{ ...TRACKED_BOOKING, status: 'cancelled' }] })
  )
  await signInAs(page, 'test@servicehub.local')

  await page.getByRole('button', { name: 'Track' }).first().click()

  await expect(page.locator('.current-update')).toContainText('This booking has been cancelled.')
  await expect(page.locator('.cancelled-message')).toBeVisible()
})

test('9. footer is visible on the homepage', async ({ page }) => {
  await expect(page.locator('footer.footer')).toBeVisible()
})

test('10. theme toggle switches to dark mode', async ({ page }) => {
  await page.getByRole('button', { name: 'Dark mode' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  // and the button label flips
  await expect(page.getByRole('button', { name: 'Light mode' })).toBeVisible()
})

test('11. theme choice survives a page reload', async ({ page }) => {
  await page.getByRole('button', { name: 'Dark mode' }).click()
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})

test('12. How it works page opens with its heading', async ({ page }) => {
  await page.locator('.nav-links').getByRole('button', { name: 'How it works' }).click()
  await expect(
    page.getByRole('heading', { name: /one workflow for rajshahi/i })
  ).toBeVisible()
})

test('13. Sign in page renders the dashboard access heading', async ({ page }) => {
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Access your dashboard' })).toBeVisible()
})

test('14. sign in form blocks empty submit because fields are required', async ({ page }) => {
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.getByRole('button', { name: 'Sign in securely' }).click()

  await expect(page.getByRole('heading', { name: 'Access your dashboard' })).toBeVisible()
})

test('15. Create a customer account link goes to the register page', async ({ page }) => {
  await openRegister(page)
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible()
})

test('16. failed sign in pops an alert and stays signed out', async ({ page }) => {
  await page.route('**/api/auth/login', route =>
    route.fulfill({ status: 401, json: { message: 'Invalid credentials' } })
  )
  let alertMessage = ''
  page.on('dialog', async dialog => {
    alertMessage = dialog.message()
    await dialog.accept()
  })

  await signInAs(page, 'wrong@servicehub.local', 'WrongPassword')

  await expect.poll(() => alertMessage).toContain('Invalid credentials')
  await expect(page.locator('.account-pill')).toHaveCount(0)
})

test('17. signed in user can log out and gets back the guest navbar', async ({ page }) => {
  await signInAs(page, 'test@servicehub.local')
  await expect(page.locator('.account-pill')).toContainText('Test Customer')

  await page.getByRole('button', { name: 'Log out' }).click()
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible()
  await expect(page.locator('.account-pill')).toHaveCount(0)
})

test('18. register page renders with all the required fields', async ({ page }) => {
  await openRegister(page)
  await expect(page.getByPlaceholder('Example: Sam', { exact: true })).toBeVisible()
  await expect(page.getByPlaceholder('Example: sam24')).toBeVisible()
  await expect(page.getByPlaceholder('Example: 01XXXXXXXXX')).toBeVisible()
  await expect(page.getByPlaceholder('Create a password')).toBeVisible()
})

test('19. empty register form will not submit', async ({ page }) => {
  // The browser's required-field check stops this before our own messages run.
  // Those messages are covered by the RegisterPage unit test instead.
  await openRegister(page)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible()
  await expect(page.locator('.account-pill')).toHaveCount(0)
})

test('20. register without a location shows the Rajshahi location error', async ({ page }) => {
  await openRegister(page)
  await page.getByPlaceholder('Example: Sam', { exact: true }).fill('Test Customer')
  await page.getByPlaceholder('Example: sam24').fill('testcustomer')
  await page.getByPlaceholder('Example: 01XXXXXXXXX').fill('01700000000')
  await page.getByPlaceholder('Create a password').fill('Password@123')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.locator('.error-text')).toHaveText('Please select your Rajshahi location.')
})

test('21. filling the register form and confirming the SMS code creates the account', async ({ page }) => {
  await openRegister(page)
  await page.getByPlaceholder('Example: Sam', { exact: true }).fill('Test Customer')
  await page.getByPlaceholder('Example: sam24').fill('testcustomer')
  await page.getByPlaceholder('Example: 01XXXXXXXXX').fill('01700000000')
  await page.getByPlaceholder('Create a password').fill('Password@123')
  await page.locator('.auth-card select').selectOption({ index: 1 })

  // The account is only created after the phone number is confirmed with an SMS code.
  let registerBody = null
  await page.route('**/api/auth/phone-verification/request', route =>
    route.fulfill({ json: { verificationId: 'verify-1' } })
  )
  await page.route('**/api/auth/phone-verification/verify', route =>
    route.fulfill({ json: { verificationToken: 'phone-token-1' } })
  )
  await page.route('**/api/auth/register/customer', route => {
    registerBody = JSON.parse(route.request().postData() || '{}')
    return route.fulfill({ json: MOCK_CUSTOMER_LOGIN })
  })

  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('heading', { name: 'Check your phone' })).toBeVisible()
  await page.getByPlaceholder('000000').fill('123456')
  await page.getByRole('button', { name: 'Verify and create account' }).click()

  await expect(page.locator('.account-pill')).toContainText('Test Customer')
  // The server-issued token, not the raw code, is what authorises the new account.
  expect(registerBody.phoneVerificationToken).toBe('phone-token-1')
  expect(registerBody.username).toBe('testcustomer')
})

test('22. Become a provider opens the provider register page', async ({ page }) => {
  await page.locator('.nav-links').getByRole('button', { name: 'Become a provider' }).click()
  await expect(page.getByRole('heading', { name: 'Apply to become a provider' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Create your account' })).toHaveCount(0)
})

// ---------- Admin sign in and dashboard ----------

test('23. admin can sign in and is taken to the admin dashboard', async ({ page }) => {
  await mockAdminApi(page)
  // This login returns userType admin instead of customer.
  await page.route('**/api/auth/login', route => route.fulfill({ json: MOCK_ADMIN_LOGIN }))

  await signInAs(page, 'admin@servicehub.local')

  // Check the heading, the role pill and the stat cards rather than just assuming the page changed.
  await expect(page.getByRole('heading', { name: 'Admin dashboard' })).toBeVisible()
  await expect(page.locator('.ops-role-pill')).toContainText(/admin/i)
  await expect(page.getByText('Total users')).toBeVisible()
})

test('24. admin can move between the sidebar sections', async ({ page }) => {
  await mockAdminApi(page)
  await page.route('**/api/auth/login', route => route.fulfill({ json: MOCK_ADMIN_LOGIN }))

  await signInAs(page, 'admin@servicehub.local')
  await page.getByRole('button', { name: 'Block requests' }).click()

  await expect(page.getByRole('heading', { name: 'Block requests' })).toBeVisible()
})

test('25. admin can log out and gets the guest navbar back', async ({ page }) => {
  await mockAdminApi(page)
  await page.route('**/api/auth/login', route => route.fulfill({ json: MOCK_ADMIN_LOGIN }))

  await signInAs(page, 'admin@servicehub.local')
  await expect(page.locator('.ops-role-pill')).toBeVisible()

  await page.getByRole('button', { name: 'Log out' }).click()

  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible()
  await expect(page.locator('.ops-role-pill')).toHaveCount(0)
})

test('26. rejected admin login shows the error and never reaches the dashboard', async ({ page }) => {
  await mockAdminApi(page)
  await page.route('**/api/auth/login', route =>
    route.fulfill({ status: 401, json: { message: 'Invalid credentials' } })
  )
  let alertMessage = ''
  page.on('dialog', async dialog => {
    alertMessage = dialog.message()
    await dialog.accept()
  })

  await signInAs(page, 'admin@servicehub.local', 'WrongPassword')

  await expect.poll(() => alertMessage).toContain('Invalid credentials')
  // The important half of this test. A rejected login must not leave any admin
  // surface on screen.
  await expect(page.getByRole('heading', { name: 'Admin dashboard' })).toHaveCount(0)
  await expect(page.locator('.ops-role-pill')).toHaveCount(0)
})

// ---------- Provider sign in and dashboard ----------

test('27. a provider does not get the admin management panels', async ({ page }) => {
  await mockProviderApi(page)
  await page.route('**/api/auth/login', route => route.fulfill({ json: MOCK_PROVIDER_LOGIN }))

  await signInAs(page, 'provider@servicehub.local')
  await expect(page.locator('.ops-role-pill')).toContainText(/provider/i)

  // Signed in as a provider, the admin only sections should not render at all.
  await expect(page.getByRole('heading', { name: 'User management' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Service provider management' })).toHaveCount(0)
})

// ---------- Role detection at sign in ----------

test('28. sign in sends only the identifier and password; the backend decides the role', async ({ page }) => {
  await mockProviderApi(page)
  let sentBody = null
  await page.route('**/api/auth/login', route => {
    sentBody = JSON.parse(route.request().postData() || '{}')
    return route.fulfill({ json: MOCK_PROVIDER_LOGIN })
  })

  await signInAs(page, 'provider@servicehub.local')

  await expect.poll(() => sentBody?.identifier).toBe('provider@servicehub.local')
  expect(sentBody.userType).toBeUndefined()
  // The role in the response, not anything typed, decides which workspace opens.
  await expect(page.locator('.ops-role-pill')).toContainText(/provider/i)
})

// ---------- Navigation survives reloads ----------

test('29. reloading keeps the user on the page they were viewing', async ({ page }) => {
  await page.locator('.nav-links').getByRole('button', { name: 'How it works' }).click()
  await expect(page).toHaveURL(/#how$/)
  await page.reload()
  await expect(
    page.getByRole('heading', { name: /one workflow for rajshahi/i })
  ).toBeVisible()
  // the browser back button returns to the homepage
  await page.goBack()
  await expect(page).toHaveURL(/#home$/)
})
