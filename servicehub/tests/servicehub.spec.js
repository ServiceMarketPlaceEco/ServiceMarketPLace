

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

// Signs in through the real form rather than faking a session, so the account
async function signInAs(page, role, email, password = 'Password@123') {
  await page.locator('.nav-links').getByRole('button', { name: 'Sign in' }).click()
  await page.locator('.auth-card select').selectOption(role)
  await page.getByPlaceholder(/admin01/i).fill(email)
  await page.getByPlaceholder('Enter password').fill(password)
  await page.locator('.auth-card').getByRole('button', { name: 'Sign in' }).click()
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

test('4. guest navbar shows Home, How it works, Sign in and Become a provider', async ({ page }) => {
  const nav = page.locator('.nav-links')
  await expect(nav.getByRole('button', { name: 'Home' })).toBeVisible()
  await expect(nav.getByRole('button', { name: 'How it works' })).toBeVisible()
  await expect(nav.getByRole('button', { name: 'Sign in' })).toBeVisible()
  await expect(nav.getByRole('button', { name: 'Become a provider' })).toBeVisible()
})

test('5. guest navbar does not show Dashboard or Log out', async ({ page }) => {
  await expect(page.locator('.nav-links').getByRole('button', { name: 'Dashboard' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Log out' })).toHaveCount(0)
})

test('6. hero has the Find services and View tracking demo buttons', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Find services' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'View tracking demo' })).toBeVisible()
})

test('7. View tracking demo opens the tracking page', async ({ page }) => {
  await page.getByRole('button', { name: 'View tracking demo' }).click()
  await expect(page.getByText(/live tracking demo/i)).toBeVisible()
})

test('8. footer is visible on the homepage', async ({ page }) => {
  await expect(page.locator('footer.footer')).toBeVisible()
})



test('9. theme toggle switches to dark mode', async ({ page }) => {
  await page.getByRole('button', { name: 'Dark mode' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  // and the button label flips
  await expect(page.getByRole('button', { name: 'Light mode' })).toBeVisible()
})

test('10. theme choice survives a page reload', async ({ page }) => {
  await page.getByRole('button', { name: 'Dark mode' }).click()
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})


test('11. How it works page opens with its heading', async ({ page }) => {
  await page.locator('.nav-links').getByRole('button', { name: 'How it works' }).click()
  await expect(
    page.getByRole('heading', { name: /one workflow for rajshahi/i })
  ).toBeVisible()
})



test('12. Sign in page renders the dashboard access heading', async ({ page }) => {
  await page.locator('.nav-links').getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: 'Access your dashboard' })).toBeVisible()
})

test('13. account type dropdown has customer, provider and admin', async ({ page }) => {
  await page.locator('.nav-links').getByRole('button', { name: 'Sign in' }).click()
  const options = page.locator('.auth-card select option')
  await expect(options).toHaveText([
    'Customer dashboard',
    'Provider dashboard',
    'Admin dashboard'
  ])
})

test('14. sign in form blocks empty submit because fields are required', async ({ page }) => {
  await page.locator('.nav-links').getByRole('button', { name: 'Sign in' }).click()
  await page.locator('.auth-card').getByRole('button', { name: 'Sign in' }).click()

  await expect(page.getByRole('heading', { name: 'Access your dashboard' })).toBeVisible()
})

test('15. Create customer account link goes to the register page', async ({ page }) => {
  await page.locator('.nav-links').getByRole('button', { name: 'Sign in' }).click()
  await page.getByRole('button', { name: 'Create customer account' }).click()
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible()
})

test('16. customer can sign in and lands on the dashboard', async ({ page }) => {
  await page.locator('.nav-links').getByRole('button', { name: 'Sign in' }).click()
  await page.getByPlaceholder(/admin01/i).fill('test@servicehub.local')
  await page.getByPlaceholder('Enter password').fill('Password@123')
  await page.locator('.auth-card').getByRole('button', { name: 'Sign in' }).click()

  await expect(page.locator('.account-pill')).toContainText('Test Customer')
  await expect(page.locator('.nav-links').getByRole('button', { name: 'Dashboard' })).toBeVisible()
})

test('17. failed sign in pops an alert and stays signed out', async ({ page }) => {
 
  await page.route('**/api/auth/login', route =>
    route.fulfill({ status: 401, json: { message: 'Invalid credentials' } })
  )
  let alertMessage = ''
  page.on('dialog', async dialog => {
    alertMessage = dialog.message()
    await dialog.accept()
  })

  await page.locator('.nav-links').getByRole('button', { name: 'Sign in' }).click()
  await page.getByPlaceholder(/admin01/i).fill('wrong@servicehub.local')
  await page.getByPlaceholder('Enter password').fill('WrongPassword')
  await page.locator('.auth-card').getByRole('button', { name: 'Sign in' }).click()

  await expect.poll(() => alertMessage).toContain('Invalid credentials')
  await expect(page.locator('.account-pill')).toHaveCount(0)
})

test('18. signed in user can log out and gets back the guest navbar', async ({ page }) => {
  await page.locator('.nav-links').getByRole('button', { name: 'Sign in' }).click()
  await page.getByPlaceholder(/admin01/i).fill('test@servicehub.local')
  await page.getByPlaceholder('Enter password').fill('Password@123')
  await page.locator('.auth-card').getByRole('button', { name: 'Sign in' }).click()
  await expect(page.locator('.account-pill')).toBeVisible()

  await page.getByRole('button', { name: 'Log out' }).click()
  await expect(page.locator('.nav-links').getByRole('button', { name: 'Sign in' })).toBeVisible()
  await expect(page.locator('.account-pill')).toHaveCount(0)
})



test('19. register page renders with all the required fields', async ({ page }) => {
  await page.locator('.nav-links').getByRole('button', { name: 'Sign in' }).click()
  await page.getByRole('button', { name: 'Create customer account' }).click()
  await expect(page.getByPlaceholder('Example: Sam')).toBeVisible()
  await expect(page.getByPlaceholder('Example: 01XXXXXXXXX')).toBeVisible()
  await expect(page.getByPlaceholder('Create a password')).toBeVisible()
})

test('20. empty register submit shows the name error first', async ({ page }) => {
  await page.locator('.nav-links').getByRole('button', { name: 'Sign in' }).click()
  await page.getByRole('button', { name: 'Create customer account' }).click()
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.locator('.error-text')).toHaveText('Name is required.')
})

test('21. register with name only asks for the phone number next', async ({ page }) => {
  await page.locator('.nav-links').getByRole('button', { name: 'Sign in' }).click()
  await page.getByRole('button', { name: 'Create customer account' }).click()
  await page.getByPlaceholder('Example: Sam').fill('Test Customer')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.locator('.error-text')).toHaveText('Phone number is required.')
})

test('22. register without a location shows the Rajshahi location error', async ({ page }) => {
  await page.locator('.nav-links').getByRole('button', { name: 'Sign in' }).click()
  await page.getByRole('button', { name: 'Create customer account' }).click()
  await page.getByPlaceholder('Example: Sam').fill('Test Customer')
  await page.getByPlaceholder('Example: 01XXXXXXXXX').fill('01700000000')
  await page.getByPlaceholder('Create a password').fill('Password@123')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.locator('.error-text')).toHaveText('Please select your Rajshahi location.')
})

test('23. google continue without details shows its own error message', async ({ page }) => {
  await page.locator('.nav-links').getByRole('button', { name: 'Sign in' }).click()
  await page.getByRole('button', { name: 'Create customer account' }).click()
  await page.getByRole('button', { name: 'Continue with Google' }).click()
  await expect(page.locator('.error-text')).toContainText('before continuing with Google')
})

test('24. filling the whole register form creates the account and signs in', async ({ page }) => {
  await page.locator('.nav-links').getByRole('button', { name: 'Sign in' }).click()
  await page.getByRole('button', { name: 'Create customer account' }).click()
  await page.getByPlaceholder('Example: Sam').fill('Test Customer')
  await page.getByPlaceholder('Example: 01XXXXXXXXX').fill('01700000000')
  await page.getByPlaceholder('Create a password').fill('Password@123')
  
  await page.locator('.auth-card select').selectOption({ index: 1 })
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.locator('.account-pill')).toContainText('Test Customer')
})



test('25. homepage shows service cards from the (mocked) catalog', async ({ page }) => {

  await expect(page.getByText('Home Cleaning').first()).toBeVisible()
})

test('26. Become a provider opens the provider register page', async ({ page }) => {
  await page.locator('.nav-links').getByRole('button', { name: 'Become a provider' }).click()
  await expect(page.getByText(/provider/i).first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Create your account' })).toHaveCount(0)
})

// ---------- Admin sign in and dashboard ----------

test('27. admin can sign in and is taken to the admin dashboard', async ({ page }) => {
  await mockAdminApi(page)
  // This login returns userType admin instead of customer.
  await page.route('**/api/auth/login', route => route.fulfill({ json: MOCK_ADMIN_LOGIN }))

  await signInAs(page, 'admin', 'admin@servicehub.local')

  // The admin dashboard has its own heading and a role pill in the sidebar, so
  // I have to check both rather than just assuming the page changed.
  await expect(page.getByRole('heading', { name: 'Admin dashboard' })).toBeVisible()
  await expect(page.locator('.ops-role-pill')).toContainText('Admin')
})

test('28. admin dashboard shows the management panels, not the customer view', async ({ page }) => {
  await mockAdminApi(page)
  await page.route('**/api/auth/login', route => route.fulfill({ json: MOCK_ADMIN_LOGIN }))

  await signInAs(page, 'admin', 'admin@servicehub.local')

  await expect(page.getByRole('heading', { name: 'User management' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Service provider management' })).toBeVisible()
})

test('29. admin dashboard shows the stat cards', async ({ page }) => {
  await mockAdminApi(page)
  await page.route('**/api/auth/login', route => route.fulfill({ json: MOCK_ADMIN_LOGIN }))

  await signInAs(page, 'admin', 'admin@servicehub.local')

  await expect(page.locator('.stat-card').first()).toBeVisible()
  await expect(page.getByText('Total users')).toBeVisible()
})

test('30. admin can move between the sidebar sections', async ({ page }) => {
  await mockAdminApi(page)
  await page.route('**/api/auth/login', route => route.fulfill({ json: MOCK_ADMIN_LOGIN }))

  await signInAs(page, 'admin', 'admin@servicehub.local')
  await page.getByRole('button', { name: 'Block requests' }).click()

  await expect(page.getByRole('heading', { name: 'Block requests' })).toBeVisible()
})

test('31. admin can log out and gets the guest navbar back', async ({ page }) => {
  await mockAdminApi(page)
  await page.route('**/api/auth/login', route => route.fulfill({ json: MOCK_ADMIN_LOGIN }))

  await signInAs(page, 'admin', 'admin@servicehub.local')
  await expect(page.locator('.ops-role-pill')).toBeVisible()

  await page.getByRole('button', { name: 'Log out' }).click()

  await expect(page.locator('.nav-links').getByRole('button', { name: 'Sign in' })).toBeVisible()
  await expect(page.locator('.ops-role-pill')).toHaveCount(0)
})

test('32. rejected admin login shows the error and never reaches the dashboard', async ({ page }) => {
  await mockAdminApi(page)
  await page.route('**/api/auth/login', route =>
    route.fulfill({ status: 401, json: { message: 'Invalid credentials' } })
  )
  let alertMessage = ''
  page.on('dialog', async dialog => {
    alertMessage = dialog.message()
    await dialog.accept()
  })

  await signInAs(page, 'admin', 'admin@servicehub.local', 'WrongPassword')

  await expect.poll(() => alertMessage).toContain('Invalid credentials')
  // The important half of this test. A rejected login must not leave any admin
  // surface on screen.
  await expect(page.getByRole('heading', { name: 'Admin dashboard' })).toHaveCount(0)
  await expect(page.locator('.ops-role-pill')).toHaveCount(0)
})

// ---------- Provider sign in and dashboard ----------

test('33. provider can sign in and is taken to the provider dashboard', async ({ page }) => {
  await mockProviderApi(page)
  await page.route('**/api/auth/login', route => route.fulfill({ json: MOCK_PROVIDER_LOGIN }))

  await signInAs(page, 'provider', 'provider@servicehub.local')

  await expect(page.locator('.ops-role-pill')).toContainText(/provider/i)
})

test('34. a provider does not get the admin management panels', async ({ page }) => {
  await mockProviderApi(page)
  await page.route('**/api/auth/login', route => route.fulfill({ json: MOCK_PROVIDER_LOGIN }))

  await signInAs(page, 'provider', 'provider@servicehub.local')

  // Signed in as a provider, the admin only sections should not render at all.
  await expect(page.getByRole('heading', { name: 'User management' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Service provider management' })).toHaveCount(0)
})

test('35. the account type dropdown is actually sent to the login api', async ({ page }) => {
  await mockAdminApi(page)
  let sentBody = null
  await page.route('**/api/auth/login', route => {
    sentBody = JSON.parse(route.request().postData() || '{}')
    return route.fulfill({ json: MOCK_ADMIN_LOGIN })
  })

  await signInAs(page, 'admin', 'admin@servicehub.local')

  // Picking Admin dashboard has to reach the backend as userType admin. 
  await expect.poll(() => sentBody?.userType).toBe('admin')
})
