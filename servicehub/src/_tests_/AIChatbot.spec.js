import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// The chatbot talks to the backend through api.sendChatbotMessage, so that is
// the only thing mocked. Everything else is the real component.
vi.mock('../services/api', () => ({ sendChatbotMessage: vi.fn() }))

import * as api from '../services/api'
import AIChatbot from '../components/AI/AIChatbot.vue'

async function openChat() {
  const wrapper = mount(AIChatbot)
  await wrapper.find('.ai-fab').trigger('click')
  return wrapper
}

describe('AIChatbot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('stays closed until the help button is pressed, then shows the greeting', async () => {
    const wrapper = mount(AIChatbot)
    expect(wrapper.find('.ai-panel').exists()).toBe(false)

    await wrapper.find('.ai-fab').trigger('click')

    expect(wrapper.find('.ai-panel').exists()).toBe(true)
    expect(wrapper.text()).toContain('I am the ServiceHub AI assistant')
  })

  it('sends the typed question with recent history and shows the reply', async () => {
    api.sendChatbotMessage.mockResolvedValue({ reply: 'Open Services and pick Home Cleaning.' })
    const wrapper = await openChat()

    await wrapper.find('input[aria-label="Chatbot message"]').setValue('  How do I book?  ')
    await wrapper.find('form.ai-compose').trigger('submit')
    await flushPromises()

    // The question is trimmed and the history uses the backend's { role, content } shape.
    const [message, history] = api.sendChatbotMessage.mock.calls[0]
    expect(message).toBe('How do I book?')
    expect(history[0]).toEqual({ role: 'assistant', content: expect.stringContaining('ServiceHub AI assistant') })

    const messages = wrapper.findAll('.ai-message').map(m => m.text())
    expect(messages).toContain('How do I book?')
    expect(messages).toContain('Open Services and pick Home Cleaning.')
    // The input is cleared after sending.
    expect(wrapper.find('input[aria-label="Chatbot message"]').element.value).toBe('')
  })

  it('does not send an empty or blank message', async () => {
    const wrapper = await openChat()

    await wrapper.find('input[aria-label="Chatbot message"]').setValue('   ')
    await wrapper.find('form.ai-compose').trigger('submit')
    await flushPromises()

    expect(api.sendChatbotMessage).not.toHaveBeenCalled()
    expect(wrapper.find('.ai-compose button[type="submit"]').attributes('disabled')).toBeDefined()
  })

  it('sends a quick question when a suggestion button is pressed', async () => {
    api.sendChatbotMessage.mockResolvedValue({ reply: 'Use the Track button on your booking.' })
    const wrapper = await openChat()

    const quick = wrapper.findAll('.ai-quick-actions button').find(b => b.text() === 'Tracking')
    await quick.trigger('click')
    await flushPromises()

    expect(api.sendChatbotMessage.mock.calls[0][0]).toBe('How do I track my request?')
    expect(wrapper.text()).toContain('Use the Track button on your booking.')
  })

  it('shows a friendly message when the assistant is unavailable', async () => {
    api.sendChatbotMessage.mockRejectedValue(new Error('Network error'))
    const wrapper = await openChat()

    await wrapper.find('input[aria-label="Chatbot message"]').setValue('Hello')
    await wrapper.find('form.ai-compose').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('The assistant is temporarily unavailable')
    // Loading ends, so the person can try again.
    expect(wrapper.find('input[aria-label="Chatbot message"]').attributes('disabled')).toBeUndefined()
  })

  it('locks the input while a reply is on its way, so questions are not sent twice', async () => {
    let finish
    api.sendChatbotMessage.mockReturnValue(new Promise(resolve => { finish = resolve }))
    const wrapper = await openChat()

    await wrapper.find('input[aria-label="Chatbot message"]').setValue('First question')
    await wrapper.find('form.ai-compose').trigger('submit')
    await flushPromises()

    expect(wrapper.find('input[aria-label="Chatbot message"]').attributes('disabled')).toBeDefined()
    await wrapper.findAll('.ai-quick-actions button')[0].trigger('click')
    expect(api.sendChatbotMessage).toHaveBeenCalledTimes(1)

    finish({ reply: 'Done' })
    await flushPromises()
    expect(wrapper.text()).toContain('Done')
  })

  it('closes with the close button', async () => {
    const wrapper = await openChat()
    await wrapper.find('button[aria-label="Close chatbot"]').trigger('click')
    expect(wrapper.find('.ai-panel').exists()).toBe(false)
  })
})
