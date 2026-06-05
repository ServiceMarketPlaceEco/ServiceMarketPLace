import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'

import NavBar from '../components/User/NavBar.vue'
import ServiceGrid from '../components/User/ServiceGrid.vue'
import CustomerDashboard from '../components/User/CustomerDashboard.vue'
import ProviderDashboard from '../components/Provider/ProviderDashboard.vue'
import AdminDashboard from '../components/Admin/AdminDashboard.vue'
import RequestForm from '../components/User/RequestForm.vue'
import RegisterPage from '../components/User/RegisterPage.vue'
import SignInPage from '../components/User/SignInPage.vue'

describe('ServiceHub Full System Test', () => {

  it('loads SignIn page', () => {
    const wrapper = mount(SignInPage)
    expect(wrapper.exists()).toBe(true)
  })

  it('loads Register page', () => {
    const wrapper = mount(RegisterPage)
    expect(wrapper.exists()).toBe(true)
  })

  it('loads Navigation Bar', () => {
    const wrapper = mount(NavBar)
    expect(wrapper.exists()).toBe(true)
  })

  it('loads Service Grid', () => {
    const wrapper = mount(ServiceGrid, {
      props: {
        services: []
      }
    })

    expect(wrapper.exists()).toBe(true)
  })

  it('loads Customer Dashboard', () => {
    const wrapper = mount(CustomerDashboard, {
      props: {
        signedInUser: null,
        requests: []
      }
    })

    expect(wrapper.exists()).toBe(true)
  })

  it('loads Provider Dashboard', () => {
    const wrapper = mount(ProviderDashboard, {
      props: {
        signedInUser: null,
        requests: []
      }
    })

    expect(wrapper.exists()).toBe(true)
  })

  it('loads Admin Dashboard', () => {
    const wrapper = mount(AdminDashboard, {
      props: {
        requests: [],
        users: [],
        providers: []
      }
    })

    expect(wrapper.exists()).toBe(true)
  })

  it('loads Request Form', () => {
    const wrapper = mount(RequestForm, {
      props: {
        signedInUser: {
          id: 1,
          name: 'Amy',
          role: 'customer'
        }
      }
    })

    expect(wrapper.exists()).toBe(true)
  })
})