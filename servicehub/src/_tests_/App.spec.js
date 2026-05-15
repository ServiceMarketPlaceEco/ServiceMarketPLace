import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import App from '../App.vue'

function findButton(wrapper, text) {
  const button = wrapper.findAll('button').find(btn => btn.text().toLowerCase().includes(text.toLowerCase()))
  if (!button) throw new Error(`Could not find button containing: ${text}`)
  return button
}

async function signInAs(wrapper, username, password) {
  await findButton(wrapper, 'Sign in').trigger('click')
  const inputs = wrapper.findAll('input')
  await inputs[0].setValue(username)
  await inputs[1].setValue(password)
  await wrapper.find('form').trigger('submit.prevent')
}

describe('App.vue end-to-end workflow', () => {
  it('renders public home page for guests', () => {
    const wrapper = mount(App)

    expect(wrapper.text()).toContain('Service Hub')
    expect(wrapper.text()).toContain('Find Services')
    expect(wrapper.text()).toContain('Register')
    expect(wrapper.text()).toContain('Sign in')
  })

  it('redirects guest to sign-in when trying to open dashboard', async () => {
    const wrapper = mount(App)

    await findButton(wrapper, 'View dashboard').trigger('click')

    expect(wrapper.text()).toContain('Secure access')
    expect(wrapper.text()).toContain('Sign in')
  })

  it('shows an error for invalid login', async () => {
    const wrapper = mount(App)

    await signInAs(wrapper, 'wronguser', 'wrongpass')

    expect(wrapper.text().toLowerCase()).toContain('invalid login')
  })

  it('logs in a customer and shows customer dashboard', async () => {
    const wrapper = mount(App)

    await signInAs(wrapper, 'customer', '1234')

    expect(wrapper.text()).toContain('Customer')
    expect(wrapper.text()).toContain('Sign out')
  })

  it('logs in a provider and shows provider operations dashboard', async () => {
    const wrapper = mount(App)

    await signInAs(wrapper, 'provider', '2222')

    expect(wrapper.text()).toContain('Abdul Karim')
    expect(wrapper.text()).toContain('Service provider')
  })

  it('logs in an admin and shows admin dashboard', async () => {
    const wrapper = mount(App)

    await signInAs(wrapper, 'admin', '1111')

    expect(wrapper.text()).toContain('Admin')
  })

  it('changes theme when theme toggle is clicked', async () => {
    const wrapper = mount(App)

    await findButton(wrapper, 'Dark mode').trigger('click')

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('updates selected location from the location modal', async () => {
    const wrapper = mount(App)

    await findButton(wrapper, 'Rajshahi City').trigger('click')
    await findButton(wrapper, 'Boalia').trigger('click')

    expect(wrapper.text()).toContain('Boalia')
  })

  it('signs out and returns to guest navigation', async () => {
    const wrapper = mount(App)

    await signInAs(wrapper, 'customer', '1234')
    await findButton(wrapper, 'Sign out').trigger('click')

    expect(wrapper.text()).toContain('Register')
    expect(wrapper.text()).toContain('Sign in')
  })
})
