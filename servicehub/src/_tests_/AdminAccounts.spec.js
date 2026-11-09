import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// AdminAccounts talks to the backend through these api calls only.
vi.mock('../services/api', () => ({
  getAdmins: vi.fn(),
  createAdmin: vi.fn(),
  deactivateAdmin: vi.fn(),
  activateAdmin: vi.fn(),
  changeMyAdminPassword: vi.fn()
}))

import * as api from '../services/api'
import AdminAccounts from '../components/Admin/AdminAccounts.vue'

const seeded = { id: 'seeded', name: 'Super Admin', email: 'admin@servicehub.com', role: 'super_admin', isActive: true }
const me = { id: 'me', name: 'Rahima Khatun', email: 'rahima@servicehub.example', role: 'super_admin', isActive: true }

async function mountAs(currentUserId, admins) {
  api.getAdmins.mockResolvedValue(admins)
  const wrapper = mount(AdminAccounts, { props: { currentUserId } })
  await flushPromises()
  return wrapper
}

describe('AdminAccounts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('warns while the default admin is still switched on', async () => {
    const wrapper = await mountAs('seeded', [seeded])

    expect(wrapper.find('.launch-warning').text()).toContain('Switch off the demo admin before launch')
    expect(wrapper.find('.launch-warning').text()).toContain('You are signed in as the demo admin')
  })

  it('stops warning once the default admin is switched off', async () => {
    const wrapper = await mountAs('me', [me, { ...seeded, isActive: false }])

    expect(wrapper.find('.launch-warning').exists()).toBe(false)
  })

  it('does not offer to switch off your own account', async () => {
    const wrapper = await mountAs('me', [me, seeded])

    const rows = wrapper.findAll('tbody tr')
    const mine = rows.find(r => r.text().includes('Rahima'))
    expect(mine.text()).toContain('You')
    expect(mine.find('button').exists()).toBe(false)
  })

  it('switches off the default admin', async () => {
    const wrapper = await mountAs('me', [me, seeded])
    api.deactivateAdmin.mockResolvedValue({})

    const row = wrapper.findAll('tbody tr').find(r => r.text().includes('admin@servicehub.com'))
    await row.find('button').trigger('click')
    await flushPromises()

    expect(api.deactivateAdmin).toHaveBeenCalledWith('seeded')
  })

  it('adds a super admin with a strong password', async () => {
    const wrapper = await mountAs('seeded', [seeded])
    api.createAdmin.mockResolvedValue({ id: 'new' })
    const inputs = wrapper.findAll('form').at(0).findAll('input')

    await inputs.at(0).setValue('Rahima Khatun')
    await inputs.at(1).setValue('rahima@servicehub.example')
    await inputs.at(2).setValue('Strong@Pass1')
    await inputs.at(3).setValue('Strong@Pass1')
    await wrapper.findAll('form').at(0).trigger('submit')
    await flushPromises()

    expect(api.createAdmin).toHaveBeenCalledWith({
      name: 'Rahima Khatun',
      email: 'rahima@servicehub.example',
      password: 'Strong@Pass1',
      role: 'super_admin'
    })
  })

  it('refuses a weak or mismatched password before calling the backend', async () => {
    const wrapper = await mountAs('seeded', [seeded])
    const form = wrapper.findAll('form').at(0)
    const inputs = form.findAll('input')
    await inputs.at(0).setValue('A')
    await inputs.at(1).setValue('a@b.com')
    await inputs.at(2).setValue('password')
    await inputs.at(3).setValue('password')
    await form.trigger('submit')

    expect(form.text()).toContain('uppercase')
    expect(api.createAdmin).not.toHaveBeenCalled()
  })

  it('changes your own password and shows the backend error if the current one is wrong', async () => {
    const wrapper = await mountAs('me', [me])
    api.changeMyAdminPassword.mockRejectedValue(new Error('Your current password is not right'))
    const form = wrapper.findAll('form').at(1)
    const inputs = form.findAll('input')
    await inputs.at(0).setValue('wrong')
    await inputs.at(1).setValue('Brand@New2026')
    await inputs.at(2).setValue('Brand@New2026')
    await form.trigger('submit')
    await flushPromises()

    expect(api.changeMyAdminPassword).toHaveBeenCalledWith('wrong', 'Brand@New2026')
    expect(form.text()).toContain('Your current password is not right')
  })
})
