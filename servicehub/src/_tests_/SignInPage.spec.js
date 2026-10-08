import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import SignInPage from '../components/User/SignInPage.vue'

describe('SignInPage Google sign-in', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('no longer offers the Google demo shortcut', () => {
    const wrapper = mount(SignInPage)
    expect(wrapper.text()).not.toContain('Google demo')
  })

  it('shows a disabled Google button when no client ID is configured', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '')
    const wrapper = mount(SignInPage)
    await flushPromises()
    const button = wrapper.findAll('button').find(b => b.text() === 'Continue with Google')
    expect(button.attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('Google sign-in is not configured yet.')
  })

  it('shows the not-signed-up message and links to registration', async () => {
    const wrapper = mount(SignInPage, {
      props: { googleError: 'This user has not been signed up. Please create an account first.' }
    })
    const alert = wrapper.find('[role="alert"]')
    expect(alert.text()).toContain('This user has not been signed up')

    await alert.find('button').trigger('click')
    expect(wrapper.emitted('go-register')).toHaveLength(1)
  })
})
