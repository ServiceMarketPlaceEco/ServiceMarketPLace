import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import RegisterPage from '../components/User/RegisterPage.vue'

describe('RegisterPage.vue', () => {
  it('renders create account page', () => {
    const wrapper = mount(RegisterPage)

    expect(wrapper.exists()).toBe(true)
    expect(wrapper.text().toLowerCase()).toContain('create account')
  })
})