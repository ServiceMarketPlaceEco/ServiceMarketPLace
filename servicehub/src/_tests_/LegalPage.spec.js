import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import LegalPage from '../components/User/LegalPage.vue'

describe('LegalPage', () => {
  it('shows the privacy policy, including what is shared and with whom', () => {
    const text = mount(LegalPage, { props: { page: 'privacy' } }).text()

    expect(text).toContain('Privacy Policy')
    expect(text).toContain('Twilio')
    expect(text).toContain('We do not sell your information')
  })

  it('shows the terms of use', () => {
    const text = mount(LegalPage, { props: { page: 'terms' } }).text()

    expect(text).toContain('Terms of Use')
    expect(text).toContain('law of Bangladesh')
  })

  it('is clearly marked as a draft until the business has checked it', () => {
    const wrapper = mount(LegalPage, { props: { page: 'terms' } })

    expect(wrapper.find('.legal-draft').exists()).toBe(true)
  })
})
