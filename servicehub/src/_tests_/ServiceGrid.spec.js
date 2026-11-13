import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ServiceGrid from '../components/User/ServiceGrid.vue'

const services = [
  { id: 1, title: 'Plumbing Help', category: 'Home repair', description: 'Tap leaks, pipe issues and drainage help.' },
  { id: 2, title: 'Home Cleaning', category: 'Home', description: 'General cleaning, kitchen cleaning and household support.' },
  { id: 3, title: 'Electrician', category: 'Home repair', description: 'Fan, switch, light, socket and wiring support.' },
  { id: 4, title: 'Home Tutoring', category: 'Education', description: 'Local academic support for students.' }
]

// keep the microphone out of these tests
const mountGrid = () => mount(ServiceGrid, { props: { services }, global: { stubs: { VoiceSearch: true, ServiceCard: { props: ['service'], template: '<article class="card">{{ service.title }}</article>' } } } })
const shown = wrapper => wrapper.findAll('.card').map(c => c.text())

describe('ServiceGrid search', () => {
  it('finds a service from the worker\'s name, not only the exact service name', async () => {
    const wrapper = mountGrid()
    for (const [typed, expected] of [['plumber', 'Plumbing Help'], ['cleaner', 'Home Cleaning'], ['electricians', 'Electrician'], ['tutor', 'Home Tutoring']]) {
      await wrapper.find('input').setValue(typed)
      expect(shown(wrapper)).toEqual([expected])
    }
  })

  it('shows services matching every word first, then any word', async () => {
    const wrapper = mountGrid()
    await wrapper.find('input').setValue('kitchen cleaning')
    expect(shown(wrapper)).toEqual(['Home Cleaning'])

    await wrapper.find('input').setValue('leaking tap')
    expect(shown(wrapper)).toEqual(['Plumbing Help'])

    await wrapper.find('input').setValue('kitchen wiring')
    expect(shown(wrapper)).toEqual(['Home Cleaning', 'Electrician'])
  })

  it('shows everything for an empty search and nothing for an unknown word', async () => {
    const wrapper = mountGrid()
    expect(shown(wrapper)).toHaveLength(4)
    await wrapper.find('input').setValue('zzzz')
    expect(shown(wrapper)).toEqual([])
    expect(wrapper.text()).toContain('No matching services found')
  })

  it('still filters by category', async () => {
    const wrapper = mountGrid()
    await wrapper.findAll('.category-row button, button').find(b => b.text() === 'Home repair').trigger('click')
    expect(shown(wrapper)).toEqual(['Plumbing Help', 'Electrician'])
  })
})
