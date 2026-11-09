import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../services/api', () => ({
  getChatMessages: vi.fn(),
  sendChatMessage: vi.fn()
}))

import * as api from '../services/api'
import ChatPanel from '../components/Chat/ChatPanel.vue'

// A booking in the shape App.vue's normalizeBooking() produces.
const booking = (overrides = {}) => ({
  id: 'bk-1',
  serviceTitle: 'Home Cleaning',
  status: 'assigned-to-provider',
  providerStatus: 'accepted',
  customerName: 'Rahim',
  providerId: 'prov-1',
  providerName: 'Karim Services',
  ...overrides
})

const approval = status => ({ id: 'ap-1', requestId: 'bk-1', status })

const mountPanel = props => mount(ChatPanel, { props: { request: booking(), role: 'customer', approval: null, ...props } })

describe('ChatPanel (customer <-> provider chat)', () => {
  beforeEach(() => {
    api.getChatMessages.mockResolvedValue([])
    api.sendChatMessage.mockReset()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('explains chat opens once a provider is assigned', () => {
    const wrapper = mountPanel({ request: booking({ providerId: '', providerName: '' }) })
    expect(wrapper.text()).toContain('once a provider has been assigned')
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('asks an admin to open chat', async () => {
    const wrapper = mountPanel()
    expect(wrapper.text()).toContain('Chat with Karim Services')

    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('request-chat')).toEqual([[{ requestId: 'bk-1' }]])
    expect(api.getChatMessages).not.toHaveBeenCalled()
  })

  it('waits for the admin and re-checks the approval while pending', async () => {
    vi.useFakeTimers()
    const wrapper = mountPanel({ approval: approval('pending'), pollMs: 1000 })
    expect(wrapper.text()).toContain('waiting for an admin')
    expect(wrapper.find('textarea').exists()).toBe(false)

    vi.advanceTimersByTime(2000)
    expect(wrapper.emitted('refresh-chat')).toHaveLength(2)
    wrapper.unmount()
  })

  it('shows the conversation with my messages on my side once approved', async () => {
    api.getChatMessages.mockResolvedValue([
      { id: 'm1', senderType: 'provider', message: 'On my way', createdAt: '2026-11-06T10:00:00Z' },
      { id: 'm2', senderType: 'customer', message: 'Great, thanks', createdAt: '2026-11-06T10:01:00Z' }
    ])
    const wrapper = mountPanel({ approval: approval('approved') })
    await flushPromises()

    expect(api.getChatMessages).toHaveBeenCalledWith('bk-1')
    const rows = wrapper.findAll('.chat-bubble-row')
    expect(rows.map(r => r.find('p').text())).toEqual(['On my way', 'Great, thanks'])
    expect(rows.map(r => r.classes().includes('mine'))).toEqual([false, true])
  })

  it('sends a message and only the booking id + text go to the backend', async () => {
    api.sendChatMessage.mockResolvedValue({ id: 'm9', senderType: 'provider', message: 'Hello', createdAt: new Date().toISOString() })
    const wrapper = mountPanel({ role: 'provider', approval: approval('approved') })
    await flushPromises()

    await wrapper.find('textarea').setValue('  Hello  ')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(api.sendChatMessage).toHaveBeenCalledWith({ bookingId: 'bk-1', message: 'Hello' })
    expect(wrapper.find('textarea').element.value).toBe('')
    expect(wrapper.find('.chat-bubble-row.mine p').text()).toBe('Hello')
  })

  it('polls for new messages while approved and stops when closed', async () => {
    vi.useFakeTimers()
    const wrapper = mountPanel({ approval: approval('approved'), pollMs: 1000 })
    await flushPromises()
    expect(api.getChatMessages).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(3000)
    expect(api.getChatMessages).toHaveBeenCalledTimes(4)

    wrapper.unmount()
    vi.advanceTimersByTime(3000)
    expect(api.getChatMessages).toHaveBeenCalledTimes(4)
  })

  it('keeps history readable but stops sending after an admin closes the chat', async () => {
    api.getChatMessages.mockResolvedValue([{ id: 'm1', senderType: 'customer', message: 'hi', createdAt: '2026-11-06T10:00:00Z' }])
    const wrapper = mountPanel({ approval: approval('rejected') })
    await flushPromises()

    expect(wrapper.findAll('.chat-bubble-row')).toHaveLength(1)
    expect(wrapper.find('textarea').exists()).toBe(false)
    expect(wrapper.text()).toContain('An admin has closed this chat')
  })

  it('shows the error when sending fails and re-checks the approval', async () => {
    api.sendChatMessage.mockRejectedValue(new Error('Chat on this booking has not been approved by an admin'))
    const wrapper = mountPanel({ approval: approval('approved') })
    await flushPromises()

    await wrapper.find('textarea').setValue('hello')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('.chat-error').text()).toContain('not been approved')
    expect(wrapper.emitted('refresh-chat')).toHaveLength(1)
    expect(wrapper.find('textarea').element.value).toBe('hello')
  })
})
