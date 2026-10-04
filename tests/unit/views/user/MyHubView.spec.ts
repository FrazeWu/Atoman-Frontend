import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'

import MyHubView from '@/views/user/MyHubView.vue'
import { useAuthStore } from '@/stores/auth'

const LinkStub = defineComponent({
	props: ['to'],
	template: '<a :href="String(to)"><slot /></a>',
})

const ContinueSectionStub = defineComponent({
	props: ['module'],
	template: '<section class="continue-stub" :data-module="module" />',
})

describe('MyHubView', () => {
	it('shows identity, personal shortcuts, and continue sections', () => {
		const pinia = createPinia()
		setActivePinia(pinia)
		const authStore = useAuthStore()
		authStore.user = {
			uuid: 'user-1',
			username: 'alice',
			email: 'alice@example.com',
			display_name: 'Alice',
		}
		authStore.token = 'token'
		authStore.isAuthenticated = true

		const wrapper = mount(MyHubView, {
			global: {
				plugins: [pinia],
				stubs: {
					RouterLink: LinkStub,
					PButton: LinkStub,
					PAvatar: defineComponent({ template: '<span />' }),
					ContentContinueSection: ContinueSectionStub,
				},
			},
		})

		expect(wrapper.get('h1').text()).toBe('我的 Atoman')
		expect(wrapper.text()).toContain('Alice')
		expect(wrapper.find('a[href="/inbox"]').exists()).toBe(true)
		expect(wrapper.find('a[href="/studio"]').exists()).toBe(true)
		expect(wrapper.find('a[href="/users/alice"]').exists()).toBe(true)
		expect(wrapper.find('a[href="/users/alice/settings"]').exists()).toBe(true)
		expect(wrapper.findAll('.continue-stub').map((item) => item.attributes('data-module'))).toEqual([
			'blog',
			'podcast',
			'video',
		])
	})
})
