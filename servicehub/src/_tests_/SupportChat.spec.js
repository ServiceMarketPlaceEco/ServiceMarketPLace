import { mount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The two support screens talk to the backend through these api calls only.
vi.mock('../services/api', () => ({
  getSupportMessages: vi.fn(),
  sendSupportMessage: vi.fn(),
  getSupportThreads: vi.fn(),
  getSupportThreadMessages: vi.fn(),
  sendSupportReply: vi.fn()
}))

import * as api from '../services/api'
import SupportChat from '../components/Support/SupportChat.vue'
import AdminInbox from '../components/Support/AdminInbox.vue'

const conversation = [
  { id: 'm-1', senderType: 'customer', senderName: 'Nusrat', message: 'Can I change my booking time?', createdAt: '2026-11-12T01:00:00.000Z' },
  { id: 'm-2', senderType: 'admin', senderName: 'Rahima', message: 'Yes, what time suits you?', createdAt: '2026-11-12T01:05:00.000Z' }
]

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

afterEach(() => vi.useRealTimers())

describe('SupportChat (customer or provider writing to the admin team)', () => {
  beforeEach(() => api.getSupportMessages.mockResolvedValue(conversation))

  it('shows the conversation with my messages on the right and the admin named', async () => {
    const wrapper = mount(SupportChat, { props: { role: 'customer' } })
    await flushPromises()

    const rows = wrapper.findAll('.support-row')
    expect(rows).toHaveLength(2)
    expect(rows[0].classes()).toContain('mine')
    expect(rows[1].classes()).not.toContain('mine')
    expect(rows[1].text()).toContain('ServiceHub admin')
    wrapper.unmount()
  })

  it('tells the dashboard it has been read, so the badge clears', async () => {
    const wrapper = mount(SupportChat, { props: { role: 'customer' } })
    await flushPromises()

    expect(wrapper.emitted('read')).toBeTruthy()
    wrapper.unmount()
  })

  it('sends a message and shows it straight away', async () => {
    api.sendSupportMessage.mockResolvedValue({ id: 'm-3', senderType: 'customer', senderName: 'Nusrat', message: '11am please', createdAt: '2026-11-12T01:06:00.000Z' })
    const wrapper = mount(SupportChat, { props: { role: 'customer' } })
    await flushPromises()

    await wrapper.find('textarea').setValue('  11am please  ')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(api.sendSupportMessage).toHaveBeenCalledWith('11am please')
    expect(wrapper.findAll('.support-row').at(-1).text()).toContain('11am please')
    expect(wrapper.find('textarea').element.value).toBe('')
    wrapper.unmount()
  })

  it('keeps the draft and shows the error when sending fails', async () => {
    api.sendSupportMessage.mockRejectedValue(new Error('Too many requests'))
    const wrapper = mount(SupportChat, { props: { role: 'provider' } })
    await flushPromises()

    await wrapper.find('textarea').setValue('hello')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('.support-error').text()).toBe('Too many requests')
    expect(wrapper.find('textarea').element.value).toBe('hello')
    wrapper.unmount()
  })

  it('checks for new messages every 5 seconds and stops when closed', async () => {
    const wrapper = mount(SupportChat, { props: { role: 'customer' } })
    await flushPromises()
    api.getSupportMessages.mockResolvedValue([...conversation, { id: 'm-9', senderType: 'admin', senderName: 'Rahima', message: 'Done, moved to 11am', createdAt: '2026-11-12T01:10:00.000Z' }])

    await vi.advanceTimersByTimeAsync(5000)
    await flushPromises()
    expect(wrapper.text()).toContain('Done, moved to 11am')

    wrapper.unmount()
    const calls = api.getSupportMessages.mock.calls.length
    await vi.advanceTimersByTimeAsync(15000)
    expect(api.getSupportMessages.mock.calls.length).toBe(calls)
  })

  it('invites a first message when there are none', async () => {
    api.getSupportMessages.mockResolvedValue([])
    const wrapper = mount(SupportChat, { props: { role: 'customer' } })
    await flushPromises()

    expect(wrapper.text()).toContain('No messages yet')
    wrapper.unmount()
  })
})

describe('AdminInbox', () => {
  const threads = [
    { userType: 'provider', userId: 'p-1', userName: 'Karim Uddin', lastMessage: { message: 'Can I add Paba?', senderType: 'provider' }, lastMessageAt: '2026-11-12T02:00:00.000Z', unread: 1 },
    { userType: 'customer', userId: 'c-1', userName: 'Nusrat Jahan', lastMessage: { message: 'Yes, what time?', senderType: 'admin' }, lastMessageAt: '2026-11-12T01:05:00.000Z', unread: 0 }
  ]
  const accounts = [
    { id: 'c-1', role: 'customer', name: 'Nusrat Jahan' },
    { id: 'c-2', role: 'customer', name: 'Farhana Rahman' },
    { id: 'p-1', role: 'provider', name: 'Karim Uddin' },
    { id: 'a-1', role: 'admin', name: 'Someone Else' }
  ]

  beforeEach(() => {
    api.getSupportThreads.mockResolvedValue(threads)
    api.getSupportThreadMessages.mockResolvedValue(conversation)
  })

  it('lists conversations with unread counts and reports the total for the menu badge', async () => {
    const wrapper = mount(AdminInbox, { props: { accounts } })
    await flushPromises()

    const items = wrapper.findAll('.inbox-list button')
    expect(items).toHaveLength(2)
    expect(items[0].text()).toContain('Karim Uddin')
    expect(items[0].find('.tab-badge').text()).toBe('1')
    expect(items[1].text()).toContain('Admin: Yes, what time?')
    expect(wrapper.emitted('unread').at(-1)).toEqual([1])
    wrapper.unmount()
  })

  it('opens a conversation and clears its unread count', async () => {
    const wrapper = mount(AdminInbox, { props: { accounts } })
    await flushPromises()

    await wrapper.findAll('.inbox-list button')[0].trigger('click')
    await flushPromises()

    expect(api.getSupportThreadMessages).toHaveBeenCalledWith('provider', 'p-1')
    expect(wrapper.find('.inbox-thread-head').text()).toContain('Karim Uddin')
    expect(wrapper.findAll('.inbox-row')).toHaveLength(2)
    expect(wrapper.emitted('unread').at(-1)).toEqual([0])
    wrapper.unmount()
  })

  it('replies as the admin', async () => {
    api.sendSupportReply.mockResolvedValue({ id: 'm-4', senderType: 'admin', senderName: 'Rahima', message: 'Yes, Paba is fine', createdAt: '2026-11-12T02:05:00.000Z' })
    const wrapper = mount(AdminInbox, { props: { accounts } })
    await flushPromises()
    await wrapper.findAll('.inbox-list button')[0].trigger('click')
    await flushPromises()

    await wrapper.find('textarea').setValue('Yes, Paba is fine')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(api.sendSupportReply).toHaveBeenCalledWith('provider', 'p-1', 'Yes, Paba is fine')
    expect(wrapper.findAll('.inbox-row').at(-1).classes()).toContain('mine')
    wrapper.unmount()
  })

  it('lets the admin start a conversation with someone who has not written yet', async () => {
    api.getSupportThreadMessages.mockResolvedValue([])
    const wrapper = mount(AdminInbox, { props: { accounts } })
    await flushPromises()

    // only customers and providers can be picked, not other admins
    const options = wrapper.findAll('.inbox-start option').map(o => o.text())
    expect(options).toContain('Farhana Rahman')
    expect(options).not.toContain('Someone Else')

    await wrapper.find('.inbox-start select').setValue('customer:c-2')
    await wrapper.find('.inbox-start button').trigger('click')
    await flushPromises()

    expect(api.getSupportThreadMessages).toHaveBeenCalledWith('customer', 'c-2')
    expect(wrapper.find('.inbox-thread-head').text()).toContain('Farhana Rahman')
    expect(wrapper.text()).toContain('Write the first one below')
    wrapper.unmount()
  })
})
