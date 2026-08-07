import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MusicAlbumCreditRolesEditor from '@/components/music/MusicAlbumCreditRolesEditor.vue'

describe('MusicAlbumCreditRolesEditor.vue', () => {
	it('supports multiple fixed roles and a custom role', async () => {
		const wrapper = mount(MusicAlbumCreditRolesEditor, {
			props: {
				modelValue: [{ id: 'primary', role: 'primary', label: '' }],
				'onUpdate:modelValue': (value) => wrapper.setProps({ modelValue: value }),
			},
		})

		await wrapper.get('[data-testid="album-credit-role-producer"]').setValue(true)
		const input = wrapper.findAll('input').find((item) => item.attributes('placeholder') === '输入身份')
		await input?.setValue('Mix Engineer')
		await wrapper.get('button[aria-label="添加自定义身份"]').trigger('click')

		expect(wrapper.props('modelValue')).toEqual(expect.arrayContaining([
			expect.objectContaining({ role: 'primary' }),
			expect.objectContaining({ role: 'producer' }),
			expect.objectContaining({ role: 'custom', label: 'Mix Engineer' }),
		]))
	})
})
