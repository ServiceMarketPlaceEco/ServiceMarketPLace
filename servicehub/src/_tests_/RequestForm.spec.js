import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import RequestForm from '../components/RequestForm.vue'

const locations = ['Rajshahi City', 'Boalia', 'Shaheb Bazar']

function mountRequestForm(extraProps = {}) {
  return mount(RequestForm, {
    props: {
      selectedService: { title: 'Cleaning', price: 500 },
      selectedTask: 'Home cleaning',
      selectedLocation: 'Boalia',
      locations,
      ...extraProps
    }
  })
}

describe('RequestForm.vue', () => {
  it('displays the selected user location in the request summary', () => {
    const wrapper = mountRequestForm()
    expect(wrapper.text()).toContain('Boalia local request')
  })

  it('blocks submission when required fields are missing', async () => {
    const wrapper = mountRequestForm()

    await wrapper.find('form').trigger('submit.prevent')

    expect(wrapper.text()).toContain('please complete all required fields')
    expect(wrapper.emitted('submit-request')).toBeFalsy()
  })

  it('blocks submission when phone number is too short', async () => {
    const wrapper = mountRequestForm()

    const inputs = wrapper.findAll('input')
    const selects = wrapper.findAll('select')
    const textarea = wrapper.find('textarea')

    await selects[1].setValue('Boalia')
    await selects[3].setValue('Home')
    await selects[4].setValue('Morning')
    await inputs.find(input => input.attributes('type') === 'number').setValue('600')
    await inputs[2].setValue('House 1, Road 2')
    await inputs[3].setValue('12345')
    await textarea.setValue('Please clean the living room and kitchen.')

    await wrapper.find('form').trigger('submit.prevent')

    expect(wrapper.text()).toContain('please enter a valid phone number')
    expect(wrapper.emitted('submit-request')).toBeFalsy()
  })

  it('emits submit-request with valid booking details', async () => {
    const wrapper = mountRequestForm()

    const inputs = wrapper.findAll('input')
    const selects = wrapper.findAll('select')
    const textarea = wrapper.find('textarea')

    await selects[0].setValue('Boalia')
    await selects[1].setValue('Boalia')
    await selects[3].setValue('Home')
    await selects[4].setValue('Morning')
    await inputs.find(input => input.attributes('type') === 'number').setValue('600')
    await inputs[2].setValue('House 1, Road 2')
    await inputs[3].setValue('01712345678')
    await textarea.setValue('Please clean the living room and kitchen.')

    await wrapper.find('form').trigger('submit.prevent')

    const emitted = wrapper.emitted('submit-request')
    expect(emitted).toBeTruthy()
    expect(emitted[0][0]).toMatchObject({
      serviceTitle: 'Cleaning',
      task: 'Home cleaning',
      city: 'Boalia',
      area: 'Boalia',
      phone: '01712345678'
    })
  })
})
