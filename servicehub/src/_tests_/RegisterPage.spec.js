import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import RegisterPage from '../components/RegisterPage.vue'

describe('RegisterPage.vue', () => {
  it('blocks registration when mandatory fields are empty', async () => {
    const wrapper = mount(RegisterPage)

    await wrapper.find('form').trigger('submit.prevent')

    expect(wrapper.text().toLowerCase()).toContain('please')
    expect(wrapper.emitted('register')).toBeFalsy()
  })

  it('emits go-signin when the sign-in link/button is clicked', async () => {
    const wrapper = mount(RegisterPage)

    const button = wrapper.findAll('button').find(btn => btn.text().toLowerCase().includes('sign in'))
    await button.trigger('click')

    expect(wrapper.emitted('go-signin')).toBeTruthy()
  })

  it('allows a valid customer registration payload', async () => {
    const wrapper = mount(RegisterPage, {
      props: {
        locations: ['Rajshahi City', 'Boalia']
      }
    })

    const inputs = wrapper.findAll('input')

    await inputs[0].setValue('Amy Nguyen')
    await inputs[1].setValue('0412345678')
    await inputs[2].setValue('1234')

    const select = wrapper.find('select')
    await select.setValue('Boalia')

    await wrapper.find('form').trigger('submit.prevent')

    expect(wrapper.emitted('register')).toBeTruthy()
  })
})
