// tests for the public reviews page and the "Write a review" form
//
// the form used to let anyone pick any service and type any name, which the
// backend always rejected (H6 in the qa report). now a review is tied to one
// of the customers finished bookings, so these check each kind of visitor
// gets the right thing when they press "Write a review".
// Run with: npm run test:run

import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import ReviewsPage from '../components/User/ReviewsPage.vue'

const customer = { name: 'Fatima', role: 'customer' }
const finishedBooking = (overrides = {}) => ({
  id: 'b-1',
  serviceTitle: 'Plumbing',
  providerName: 'Rahim Plumbing Services',
  preferredDate: '2026-10-01',
  status: 'completed',
  ...overrides
})

// the form is teleported to <body>, so look for it there
const modal = () => document.body.querySelector('.modal-card')

const mountPage = props =>
  mount(ReviewsPage, { props, attachTo: document.body })

async function openForm(wrapper) {
  await wrapper.find('.review-hero button').trigger('click')
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('ReviewsPage', () => {
  it('lists the reviews with the service and provider, and the average rating', () => {
    const wrapper = mountPage({
      reviews: [
        { id: 'r-1', name: 'Fatima', serviceTitle: 'Plumbing', providerName: 'Rahim Plumbing Services', rating: 5, comment: 'quick fix' },
        { id: 'r-2', name: 'Karim', serviceTitle: 'Plumbing', providerName: '', rating: 4, comment: 'tidy' }
      ]
    })

    const cards = wrapper.findAll('.review-card')
    expect(cards).toHaveLength(2)
    expect(cards[0].text()).toContain('Plumbing · Rahim Plumbing Services')
    // no dangling dot when the provider name is missing
    expect(cards[1].find('small').text()).toBe('Plumbing')
    expect(wrapper.find('.review-summary strong').text()).toBe('4.5')
  })

  it('shows the empty state when there are no reviews', () => {
    const wrapper = mountPage({ reviews: [] })
    expect(wrapper.find('.empty-state').exists()).toBe(true)
    expect(wrapper.find('.review-summary strong').text()).toBe('0.0')
  })

  it('asks a guest to sign in instead of showing a form they cant use', async () => {
    const wrapper = mountPage({ signedInUser: null })
    await openForm(wrapper)

    expect(modal().textContent).toContain('Sign in to write a review')
    expect(document.body.querySelector('textarea')).toBeNull()

    const signIn = [...modal().querySelectorAll('button')].find(b => b.textContent.trim() === 'Sign in')
    signIn.click()
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('sign-in')).toHaveLength(1)
    expect(modal()).toBeNull()
  })

  it('tells a provider only customers can review', async () => {
    const wrapper = mountPage({ signedInUser: { name: 'Rahim', role: 'provider' } })
    await openForm(wrapper)

    expect(modal().textContent).toContain('Only customers can write reviews')
    expect(document.body.querySelector('textarea')).toBeNull()
  })

  it('tells a customer with nothing finished that they have nothing to review yet', async () => {
    const wrapper = mountPage({ signedInUser: customer, reviewableBookings: [] })
    await openForm(wrapper)

    expect(modal().textContent).toContain('No finished bookings to review')
    expect(document.body.querySelector('textarea')).toBeNull()
  })

  it('lets a customer pick one of their finished bookings and sends just the booking, rating and comment', async () => {
    const wrapper = mountPage({
      signedInUser: customer,
      reviewableBookings: [finishedBooking(), finishedBooking({ id: 'b-2', serviceTitle: 'AC Repair', providerName: 'Cool Air' })]
    })
    await openForm(wrapper)

    const select = document.body.querySelector('select')
    const options = [...select.options].map(o => o.textContent.trim())
    expect(options).toEqual([
      'Choose a finished booking',
      'Plumbing · Rahim Plumbing Services · 2026-10-01',
      'AC Repair · Cool Air · 2026-10-01'
    ])

    select.value = 'b-2'
    select.dispatchEvent(new Event('change'))
    const rating = document.body.querySelectorAll('select')[1]
    rating.value = '4'
    rating.dispatchEvent(new Event('change'))
    const comment = document.body.querySelector('textarea')
    comment.value = '  cold air again, thanks  '
    comment.dispatchEvent(new Event('input'))
    await wrapper.vm.$nextTick()

    document.body.querySelector('form').dispatchEvent(new Event('submit'))
    await wrapper.vm.$nextTick()

    // exactly the body POST /reviews accepts - no username, userType or serviceId
    expect(wrapper.emitted('submit-review')).toEqual([[{ bookingId: 'b-2', rating: 4, comment: 'cold air again, thanks' }]])
    expect(modal()).toBeNull()
  })

  it('picks the booking for them when there is only one', async () => {
    const wrapper = mountPage({ signedInUser: customer, reviewableBookings: [finishedBooking()] })
    await openForm(wrapper)

    expect(document.body.querySelector('select').value).toBe('b-1')
  })

  it('does not submit without a comment', async () => {
    const wrapper = mountPage({ signedInUser: customer, reviewableBookings: [finishedBooking()] })
    await openForm(wrapper)

    document.body.querySelector('form').dispatchEvent(new Event('submit'))
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('submit-review')).toBeUndefined()
  })
})
