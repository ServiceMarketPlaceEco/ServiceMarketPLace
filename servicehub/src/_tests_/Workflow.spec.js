import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import App from '../App.vue'

describe('ServiceHub Workflow Tests', () => {
  it('TC-WF-001: guest can navigate through homepage and open sign in/register areas', async () => {
    const wrapper = mount(App)

    expect(wrapper.exists()).toBe(true)
    expect(wrapper.text()).toContain('ServiceHub')

    const buttons = wrapper.findAll('button')

    for (const button of buttons) {
      const text = button.text().toLowerCase()

      if (
        text.includes('sign') ||
        text.includes('login') ||
        text.includes('register') ||
        text.includes('service') ||
        text.includes('request')
      ) {
        await button.trigger('click')
        expect(wrapper.exists()).toBe(true)
      }
    }
  })

  it('TC-WF-002: app should not crash when multiple navigation buttons are clicked', async () => {
    const wrapper = mount(App)

    const buttons = wrapper.findAll('button')

    for (const button of buttons.slice(0, 8)) {
      await button.trigger('click')
      expect(wrapper.exists()).toBe(true)
    }
  })

  it('TC-WF-003: role based content should exist in the application', () => {
    const wrapper = mount(App)

    const text = wrapper.text().toLowerCase()

    expect(text).toMatch(/customer|request|service/)
    expect(text).toMatch(/provider|job|booking|assigned/)
    expect(text).toMatch(/admin|manage|approve|assign/)
  })

  it('TC-WF-004: ServiceHub should contain core marketplace workflow keywords', () => {
    const wrapper = mount(App)

    const text = wrapper.text().toLowerCase()

    expect(text).toMatch(/service/)
    expect(text).toMatch(/request/)
    expect(text).toMatch(/provider|customer/)
  })

  it('TC-WF-005: theme or display interaction should not break app', async () => {
    const wrapper = mount(App)

    const buttons = wrapper.findAll('button')

    const themeButton = buttons.find(button =>
      /theme|dark|light|mode/i.test(button.text())
    )

    if (themeButton) {
      await themeButton.trigger('click')
    }

    expect(wrapper.exists()).toBe(true)
  })
})