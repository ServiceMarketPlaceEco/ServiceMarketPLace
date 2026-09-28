import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import RequestForm from '../components/User/RequestForm.vue'

const service = { id: 's1', title: 'Home Cleaning', price: 500 }
const customer = { id: 'c1', name: 'Jess', email: 'jess@example.com', location: 'Boalia' }

describe('RequestForm', () => {
  it('loads the selected service and customer', () => {
    const wrapper = mount(RequestForm, { props: { service, customer } })
    expect(wrapper.text()).toContain('Home Cleaning')
    expect(wrapper.text()).toContain('Jess')
    expect(wrapper.text()).toContain('No upfront payment required')
  })

  it('sends the complete request details', async () => {
    const wrapper = mount(RequestForm, { props: { service, customer } })
    await wrapper.find('input[type="date"]').setValue('2026-09-15')
    await wrapper.find('input[type="time"]').setValue('10:00')
    await wrapper.find('textarea').setValue('Please clean the kitchen')
    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('submit-request')[0][0]).toMatchObject({ serviceId: 's1', customerId: 'c1', budget: 500, details: 'Please clean the kitchen', paymentStatus: 'pay-after-service' })
  })

  it('includes bank details when upfront payment is needed', () => {
    const paidService = { ...service, upfrontPayment: { required: true, amount: 100, bankName: 'Test Bank', accountName: 'ServiceHub', accountNumber: '123', note: 'Use booking name' } }
    const wrapper = mount(RequestForm, { props: { service: paidService, customer } })
    expect(wrapper.text()).toContain('Upfront bank payment required')
    expect(wrapper.text()).toContain('Test Bank')
  })

  it('goes back when cancel is selected', async () => {
    const wrapper = mount(RequestForm, { props: { service, customer } })
    await wrapper.find('.form-actions .secondary').trigger('click')
    expect(wrapper.emitted('back')).toHaveLength(1)
  })
})
