import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import RequestForm from '../components/User/RequestForm.vue'

describe('RequestForm.vue', () => {
  it('renders request form', () => {
    const wrapper = mount(RequestForm, {
      props: {
        signedInUser: {
          id: 1,
          name: 'Amy',
          role: 'customer'
        },
        services: [],
        locations: []
      }
    })

    expect(wrapper.exists()).toBe(true)
    expect(wrapper.text().toLowerCase()).toMatch(/request|service/)
  })
})