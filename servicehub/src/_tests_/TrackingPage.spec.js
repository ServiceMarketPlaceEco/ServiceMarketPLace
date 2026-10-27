import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TrackingPage from '../components/User/TrackingPage.vue'

// A booking in the shape App.vue's normalizeBooking() produces.
const booking = (overrides = {}) => ({
  id: 'BK-1',
  serviceTitle: 'Home Cleaning',
  location: 'Boalia, Rajshahi',
  customerLocation: 'Boalia',
  status: 'in-progress',
  providerStatus: 'in-progress',
  providerName: 'rajshahi cleaners',
  providerPhone: '+880 1800-000000',
  ...overrides
})

const timelineStates = wrapper =>
  wrapper.findAll('.tracking-timeline li').map(li => li.find('small').text())

describe('TrackingPage (live status tracking)', () => {
  it('shows an empty state with a way back when there are no bookings', async () => {
    const wrapper = mount(TrackingPage, { props: { requests: [] } })
    expect(wrapper.find('.empty-state').exists()).toBe(true)

    await wrapper.find('.empty-state button').trigger('click')
    expect(wrapper.emitted('back')).toHaveLength(1)
  })

  it.each([
    ['waiting-provider-acceptance', 'Request received', ['Current status', 'Pending', 'Pending', 'Pending']],
    ['accepted', 'Provider assigned', ['Completed', 'Current status', 'Pending', 'Pending']],
    ['in-progress', 'Service in progress', ['Completed', 'Completed', 'Current status', 'Pending']],
    ['completed', 'Service completed', ['Completed', 'Completed', 'Completed', 'Current status']]
  ])('maps the %s status onto the right stage of the timeline', (providerStatus, _stage, expected) => {
    const wrapper = mount(TrackingPage, { props: { requests: [booking({ providerStatus })] } })
    expect(timelineStates(wrapper)).toEqual(expected)
  })

  it('shows the matching message for the current status', () => {
    const wrapper = mount(TrackingPage, { props: { requests: [booking({ providerStatus: 'accepted' })] } })
    expect(wrapper.find('.current-update').text()).toContain('A provider has been assigned')
  })

  it('shows the cancelled state and no current stage for a declined booking', () => {
    const wrapper = mount(TrackingPage, { props: { requests: [booking({ providerStatus: 'declined' })] } })
    expect(wrapper.find('.cancelled-message').exists()).toBe(true)
    expect(wrapper.find('.current-update').text()).toContain('This booking has been cancelled.')
    expect(timelineStates(wrapper)).not.toContain('Current status')
  })

  it('falls back to pending for an unknown status instead of breaking', () => {
    const wrapper = mount(TrackingPage, { props: { requests: [booking({ providerStatus: 'something-new', status: 'something-new' })] } })
    expect(timelineStates(wrapper)[0]).toBe('Current status')
  })

  it('opens the booking that was selected on the dashboard', () => {
    const requests = [booking({ id: 'BK-1', serviceTitle: 'Home Cleaning' }), booking({ id: 'BK-2', serviceTitle: 'AC Repair' })]
    const wrapper = mount(TrackingPage, { props: { requests, selectedRequest: requests[1] } })
    // Check the heading of the booking shown; the selector lists every title, so page text would always match.
    expect(wrapper.find('.booking-heading h2').text()).toBe('AC Repair')
    expect(wrapper.find('.booking-heading .eyebrow').text()).toContain('BK-2')
  })

  it('lets the customer switch between bookings when there is more than one', async () => {
    const requests = [booking({ id: 'BK-1', serviceTitle: 'Home Cleaning' }), booking({ id: 'BK-2', serviceTitle: 'AC Repair' })]
    const wrapper = mount(TrackingPage, { props: { requests } })
    expect(wrapper.find('.booking-heading h2').text()).toBe('Home Cleaning')

    await wrapper.find('.booking-selector select').setValue('BK-2')
    expect(wrapper.find('.booking-heading h2').text()).toBe('AC Repair')
  })

  it('hides the booking selector when there is only one booking', () => {
    const wrapper = mount(TrackingPage, { props: { requests: [booking()] } })
    expect(wrapper.find('.booking-selector').exists()).toBe(false)
  })

  it('shows the assigned provider with a call button only when there is a phone number', () => {
    const withPhone = mount(TrackingPage, { props: { requests: [booking()] } })
    expect(withPhone.find('.provider-card').exists()).toBe(true)
    expect(withPhone.find('.provider-avatar').text()).toBe('R')
    expect(withPhone.find('.provider-card button').exists()).toBe(true)

    const noPhone = mount(TrackingPage, { props: { requests: [booking({ providerPhone: '' })] } })
    expect(noPhone.find('.provider-card button').exists()).toBe(false)

    const noProvider = mount(TrackingPage, { props: { requests: [booking({ providerName: '' })] } })
    expect(noProvider.find('.provider-card').exists()).toBe(false)
  })

  it('goes back when the back button is pressed', async () => {
    const wrapper = mount(TrackingPage, { props: { requests: [booking()] } })
    await wrapper.find('.back-button').trigger('click')
    expect(wrapper.emitted('back')).toHaveLength(1)
  })
})
