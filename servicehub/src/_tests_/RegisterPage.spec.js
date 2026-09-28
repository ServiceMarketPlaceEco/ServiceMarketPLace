import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import RegisterPage from '../components/User/RegisterPage.vue'

describe('RegisterPage', () => {
  it('shows the first missing field error', async () => {
    const wrapper = mount(RegisterPage)
    await wrapper.find('form').trigger('submit')
    expect(wrapper.find('.error-text').text()).toBe('Name is required.')
  })

  it('sends clean customer details after a valid form', async () => {
    const wrapper = mount(RegisterPage)
    const inputs = wrapper.findAll('input')
    await inputs[0].setValue('  Jess  ')
    await inputs[1].setValue('01700000000')
    await inputs[2].setValue('Password@123')
    await wrapper.find('select').setValue(wrapper.findAll('option')[1].element.value)
    await inputs[3].setValue('jess@example.com')
    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('create-account')[0][0]).toMatchObject({ name: 'Jess', phone: '01700000000', email: 'jess@example.com', accountMethod: 'phone' })
  })

  it('opens the sign in page from the account link', async () => {
    const wrapper = mount(RegisterPage)
    await wrapper.find('.link-btn').trigger('click')
    expect(wrapper.emitted('go-signin')).toHaveLength(1)
  })
})
