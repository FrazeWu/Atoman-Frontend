import { flushPromises, mount } from '@vue/test-utils'
import { vi } from 'vitest'

import { setCSRFToken } from '@/api/transport'
import PasswordSettingsPanel from '@/components/user/PasswordSettingsPanel.vue'

describe('PasswordSettingsPanel', () => {
  afterEach(() => vi.restoreAllMocks())

  it('changes the password with the current password and csrf cookie transport', async () => {
	setCSRFToken('csrf-settings')
	const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }))
	const wrapper = mount(PasswordSettingsPanel)
	const inputs = wrapper.findAll('input')
	await inputs[0].setValue('old-password')
	await inputs[1].setValue('new-password')
	await inputs[2].setValue('new-password')
	await wrapper.get('form').trigger('submit')
	await flushPromises()
	expect(fetchMock).toHaveBeenCalledWith('/api/v1/users/me/password', expect.objectContaining({
	  method: 'PUT',
	  credentials: 'include',
	  body: JSON.stringify({
		current_password: 'old-password',
		new_password: 'new-password',
		password_confirm: 'new-password',
	  }),
	}))
	expect(wrapper.text()).toContain('密码已修改')
  })
})
