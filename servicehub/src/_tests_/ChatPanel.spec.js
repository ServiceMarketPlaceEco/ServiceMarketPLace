import { mount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The chat screen talks to the backend through these four api calls, so they
// are the only thing mocked. Everything else is the real component.
vi.mock('../services/api', () => ({
  getChats: vi.fn(),
  getChatMessages: vi.fn(),
  sendChatMessage: vi.fn(),
  startSupportChat: vi.fn()
}))

import * as api from '../services/api'
import ChatPanel from '../components/Chat/ChatPanel.vue'

const bookingChat = {
  conversationId: 'conv-1',
  type: 'booking',
  title: 'Karim Uddin',
  subtitle: 'Plumbing on 2026-11-10',
  bookingId: 'b-1',
  lastMessage: { body: 'See you at 10', senderType: 'provider', senderName: 'Karim Uddin', createdAt: '2026-11-06T01:00:00.000Z' },
  lastMessageAt: '2026-11-06T01:00:00.000Z',
  unread: 2
}
const supportChat = {
  conversationId: 'conv-2',
  type: 'customer_support',
  title: 'ServiceHub admin',
  subtitle: 'Questions about bookings or your account',
  bookingId: null,
  lastMessage: null,
  lastMessageAt: null,
  unread: 0
}
const firstMessages = [
  { messageId: 'm-1', senderType: 'customer', senderName: 'Nusrat', body: 'Hi, are you coming today?', createdAt: '2026-11-06T00:59:00.000Z' },
  { messageId: 'm-2', senderType: 'provider', senderName: 'Karim Uddin', body: 'See you at 10', createdAt: '2026-11-06T01:00:00.000Z' }
]

describe('ChatPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    api.getChats.mockResolvedValue([bookingChat, supportChat])
    api.getChatMessages.mockImplementation(async (_id, after) => (after ? [] : firstMessages))
    // the panel opens the first chat by itself on a wide screen
    window.innerWidth = 1200
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('lists the chats with their unread counts', async () => {
    window.innerWidth = 500
    const wrapper = mount(ChatPanel, { props: { role: 'customer' } })
    await flushPromises()

    const items = wrapper.findAll('.chat-item')
    expect(items).toHaveLength(2)
    expect(items[0].text()).toContain('Karim Uddin')
    expect(items[0].find('.chat-badge').text()).toBe('2')
    expect(items[1].text()).toContain('No messages yet')
    expect(wrapper.emitted('unread').at(-1)).toEqual([2])
  })

  it('opens a chat, shows its messages and clears its unread count', async () => {
    const wrapper = mount(ChatPanel, { props: { role: 'customer' } })
    await flushPromises()

    expect(api.getChatMessages).toHaveBeenCalledWith('conv-1')
    const bubbles = wrapper.findAll('.chat-bubble')
    expect(bubbles).toHaveLength(2)
    // my own message sits on the right without a name, theirs shows the sender
    expect(bubbles[0].classes()).toContain('mine')
    expect(bubbles[1].text()).toContain('Karim Uddin')
    expect(wrapper.find('.chat-item.active .chat-badge').exists()).toBe(false)
  })

  it('sends a message and shows it straight away', async () => {
    api.sendChatMessage.mockResolvedValue({
      messageId: 'm-3', senderType: 'customer', senderName: 'Nusrat', body: 'Thank you', createdAt: '2026-11-06T01:05:00.000Z'
    })
    const wrapper = mount(ChatPanel, { props: { role: 'customer' } })
    await flushPromises()

    await wrapper.find('textarea').setValue('  Thank you  ')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(api.sendChatMessage).toHaveBeenCalledWith('conv-1', 'Thank you')
    expect(wrapper.findAll('.chat-bubble').at(-1).text()).toContain('Thank you')
    expect(wrapper.find('textarea').element.value).toBe('')
  })

  it('does not send an empty message', async () => {
    const wrapper = mount(ChatPanel, { props: { role: 'customer' } })
    await flushPromises()

    await wrapper.find('textarea').setValue('   ')
    await wrapper.find('form').trigger('submit')

    expect(api.sendChatMessage).not.toHaveBeenCalled()
  })

  it('checks for new messages every 5 seconds, asking only for newer ones', async () => {
    const wrapper = mount(ChatPanel, { props: { role: 'customer' } })
    await flushPromises()
    api.getChatMessages.mockResolvedValueOnce([
      { messageId: 'm-9', senderType: 'provider', senderName: 'Karim Uddin', body: 'Running 5 minutes late', createdAt: '2026-11-06T01:10:00.000Z' }
    ])

    await vi.advanceTimersByTimeAsync(5000)
    await flushPromises()

    expect(api.getChatMessages).toHaveBeenLastCalledWith('conv-1', '2026-11-06T01:00:00.000Z')
    expect(wrapper.text()).toContain('Running 5 minutes late')
    wrapper.unmount()
  })

  it('stops refreshing when the screen is closed', async () => {
    const wrapper = mount(ChatPanel, { props: { role: 'customer' } })
    await flushPromises()
    wrapper.unmount()
    const calls = api.getChats.mock.calls.length

    await vi.advanceTimersByTimeAsync(15000)

    expect(api.getChats.mock.calls.length).toBe(calls)
  })

  it('opens the chat for a booking when asked to (the Message buttons)', async () => {
    window.innerWidth = 500
    const wrapper = mount(ChatPanel, { props: { role: 'customer', focusBookingId: 'b-1' } })
    await flushPromises()

    expect(wrapper.find('.chat-thread-head').text()).toContain('Karim Uddin')
  })

  it('shows the error when a message fails to send', async () => {
    api.sendChatMessage.mockRejectedValue(new Error('Chat not found'))
    const wrapper = mount(ChatPanel, { props: { role: 'customer' } })
    await flushPromises()

    await wrapper.find('textarea').setValue('hello')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('.chat-error').text()).toBe('Chat not found')
    // the draft is kept so nothing has to be typed again
    expect(wrapper.find('textarea').element.value).toBe('hello')
  })

  it('lets an admin start a chat with a provider', async () => {
    api.getChats.mockResolvedValue([])
    api.startSupportChat.mockResolvedValue({ ...supportChat, conversationId: 'conv-7', type: 'provider_support', title: 'Karim Uddin', subtitle: 'Provider' })
    const wrapper = mount(ChatPanel, {
      props: {
        role: 'admin',
        accounts: [
          { id: 'prov-1', role: 'provider', name: 'Karim Uddin' },
          { id: 'cust-1', role: 'customer', name: 'Nusrat Jahan' }
        ]
      }
    })
    await flushPromises()

    await wrapper.find('.chat-start select').setValue('provider:prov-1')
    await wrapper.find('.chat-start button').trigger('click')
    await flushPromises()

    expect(api.startSupportChat).toHaveBeenCalledWith('provider', 'prov-1')
    expect(wrapper.find('.chat-thread-head').text()).toContain('Karim Uddin')
  })

  it('does not show the admin picker to customers', async () => {
    const wrapper = mount(ChatPanel, { props: { role: 'customer' } })
    await flushPromises()

    expect(wrapper.find('.chat-start').exists()).toBe(false)
  })
})
