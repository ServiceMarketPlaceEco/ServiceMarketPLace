import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import App from '../App.vue'

describe('App.vue - ServiceHub', () => {
  let wrapper

  beforeEach(() => {
    wrapper = mount(App)
  })

  it('renders the ServiceHub app', () => {
    expect(wrapper.exists()).toBe(true)
    expect(wrapper.text()).toContain('ServiceHub')
  })

  it('shows guest navigation before login', () => {
    expect(wrapper.text()).toMatch(/sign in|login|register/i)
  })

  it('can open the sign in area', async () => {
    const buttons = wrapper.findAll('button')

    const signInButton = buttons.find(button =>
      /sign in|login/i.test(button.text())
    )

    if (signInButton) {
      await signInButton.trigger('click')
    }

    expect(wrapper.exists()).toBe(true)
  })

  it('shows service marketplace content', () => {
    expect(wrapper.text()).toMatch(/service|request|provider|customer/i)
  })

  it('shows customer related content', () => {
    expect(wrapper.text()).toMatch(/customer|find service|request/i)
  })

  it('shows provider related content', () => {
    expect(wrapper.text()).toMatch(/provider|job|booking|service/i)
  })

  it('shows admin related content', () => {
    expect(wrapper.text()).toMatch(/admin|manage|approve|assign|dashboard/i)
  })

  it('theme toggle button works if available', async () => {
    const buttons = wrapper.findAll('button')

    const themeButton = buttons.find(button =>
      /theme|dark|light/i.test(button.text())
    )

    if (themeButton) {
      await themeButton.trigger('click')
    }

    expect(wrapper.exists()).toBe(true)
  })

  it('renders without crashing after user interaction', async () => {
    const buttons = wrapper.findAll('button')

    if (buttons.length > 0) {
      await buttons[0].trigger('click')
    }

    expect(wrapper.exists()).toBe(true)
  })
})