import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { MusicAlbumArtistRole } from '../../../../src/api/musicV1'
// @ts-expect-error Vue SFC declarations are unavailable to the standalone TypeScript server.
import MusicAlbumCreditRolesEditor from '@/components/music/MusicAlbumCreditRolesEditor.vue'

describe('MusicAlbumCreditRolesEditor.vue', () => {
	it('reflows roles without squeezing labels into vertical text', () => {
		const source = readFileSync(
			resolve(process.cwd(), 'src/components/music/MusicAlbumCreditRolesEditor.vue'),
			'utf8',
		)

		expect(source).toContain('container: credit-roles / inline-size')
		expect(source).toContain('repeat(auto-fit, minmax(min(100%, 8rem), 1fr))')
		expect(source).toMatch(/\.credit-role-option\s*\{[^}]*white-space:\s*nowrap;/s)
		expect(source).toMatch(/\.credit-roles__custom-add\s*\{[^}]*grid-column:\s*1 \/ -1;/s)
	})

	it('supports multiple fixed roles and a custom role', async () => {
		const wrapper = mount(MusicAlbumCreditRolesEditor, {
			props: {
				modelValue: [{ id: 'primary', role: 'primary', label: '' }],
				'onUpdate:modelValue': (value: Array<{ id: string; role: MusicAlbumArtistRole; label: string }>) => wrapper.setProps({ modelValue: value }),
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
