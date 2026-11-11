import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../services/api', () => ({
  updateCustomerProfile: vi.fn(),
  changeCustomerPassword: vi.fn(),
  closeCustomerAccount: vi.fn()
}))

import * as api from '../services/api'
import CustomerSettings from '../components/User/CustomerSettings.vue'

const customer = { id: 'c-1', name: 'Nusrat Jahan', phone: '01712345678', location: 'Kazla' }
const forms = wrapper => wrapper.findAll('form')

describe('CustomerSettings', () => {
  beforeEach(() => vi.clearAllMocks())

  it('starts with the customer details, and the phone cannot be edited', () => {
    const wrapper = mount(CustomerSettings, { props: { customer } })
    const inputs = forms(wrapper)[0].findAll('input')

    expect(inputs[0].element.value).toBe('Nusrat Jahan')
    expect(inputs[1].element.value).toBe('01712345678')
    expect(inputs[1].attributes('disabled')).toBeDefined()
    expect(inputs[2].element.value).toBe('Kazla')
  })

  it('saves the name and address and passes the result up', async () => {
    api.updateCustomerProfile.mockResolvedValue({ name: 'Nusrat J. Khan', address: 'Binodpur' })
    const wrapper = mount(CustomerSettings, { props: { customer } })
    const inputs = forms(wrapper)[0].findAll('input')

    await inputs[0].setValue('  Nusrat J. Khan ')
    await inputs[2].setValue('Binodpur')
    await forms(wrapper)[0].trigger('submit')
    await flushPromises()

    expect(api.updateCustomerProfile).toHaveBeenCalledWith({ name: 'Nusrat J. Khan', address: 'Binodpur' })
    expect(wrapper.emitted('profile-updated')[0]).toEqual([{ name: 'Nusrat J. Khan', address: 'Binodpur' }])
    expect(wrapper.text()).toContain('Your details are saved')
  })

  it('does not save an empty name', async () => {
    const wrapper = mount(CustomerSettings, { props: { customer } })

    await forms(wrapper)[0].findAll('input')[0].setValue('   ')
    await forms(wrapper)[0].trigger('submit')

    expect(api.updateCustomerProfile).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Enter your name')
  })

  it('checks the new password before asking the backend', async () => {
    const wrapper = mount(CustomerSettings, { props: { customer } })
    const inputs = forms(wrapper)[1].findAll('input')

    await inputs[0].setValue('Old@Pass1')
    await inputs[1].setValue('password')
    await inputs[2].setValue('password')
    await forms(wrapper)[1].trigger('submit')
    expect(wrapper.text()).toContain('uppercase')

    await inputs[1].setValue('New@Pass2026')
    await inputs[2].setValue('Different@1')
    await forms(wrapper)[1].trigger('submit')
    expect(wrapper.text()).toContain('do not match')
    expect(api.changeCustomerPassword).not.toHaveBeenCalled()
  })

  it('changes the password and shows the backend error when the current one is wrong', async () => {
    api.changeCustomerPassword.mockRejectedValueOnce(new Error('Current password is incorrect')).mockResolvedValueOnce({})
    const wrapper = mount(CustomerSettings, { props: { customer } })
    const inputs = forms(wrapper)[1].findAll('input')
    await inputs[0].setValue('wrong')
    await inputs[1].setValue('New@Pass2026')
    await inputs[2].setValue('New@Pass2026')

    await forms(wrapper)[1].trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('Current password is incorrect')

    await inputs[0].setValue('Old@Pass1')
    await forms(wrapper)[1].trigger('submit')
    await flushPromises()
    expect(api.changeCustomerPassword).toHaveBeenLastCalledWith({ currentPassword: 'Old@Pass1', newPassword: 'New@Pass2026' })
    expect(wrapper.text()).toContain('Your password has been changed')
  })

  it('asks for the password before closing the account, and can be backed out of', async () => {
    const wrapper = mount(CustomerSettings, { props: { customer } })

    await wrapper.find('.danger-zone button').trigger('click')
    expect(wrapper.find('.danger-zone input[type="password"]').exists()).toBe(true)

    await wrapper.find('.danger-zone form').trigger('submit')
    expect(api.closeCustomerAccount).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Enter your password to confirm')

    await wrapper.find('.danger-zone button.secondary').trigger('click')
    expect(wrapper.find('.danger-zone input[type="password"]').exists()).toBe(false)
  })

  it('closes the account and tells the app, or shows why it could not', async () => {
    api.closeCustomerAccount
      .mockRejectedValueOnce(new Error('You have a job that is confirmed or in progress.'))
      .mockResolvedValueOnce({})
    const wrapper = mount(CustomerSettings, { props: { customer } })
    await wrapper.find('.danger-zone button').trigger('click')
    await wrapper.find('.danger-zone input[type="password"]').setValue('My@Pass1')

    await wrapper.find('.danger-zone form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('confirmed or in progress')
    expect(wrapper.emitted('account-closed')).toBeFalsy()

    await wrapper.find('.danger-zone form').trigger('submit')
    await flushPromises()
    expect(api.closeCustomerAccount).toHaveBeenLastCalledWith('My@Pass1')
    expect(wrapper.emitted('account-closed')).toBeTruthy()
  })
})
