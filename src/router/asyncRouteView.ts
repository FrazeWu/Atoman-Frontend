import { defineAsyncComponent, defineComponent, h, type Component } from 'vue'
import RouteContentLoading from '@/components/system/RouteContentLoading.vue'

export function asyncRouteView(loader: () => Promise<Component>) {
  const AsyncContent = defineAsyncComponent({
    loader,
    loadingComponent: RouteContentLoading,
    delay: 0,
    suspensible: false,
  })

  return defineComponent({
    name: 'AsyncRouteView',
    inheritAttrs: false,
    setup(_, { attrs }) {
      return () => h(AsyncContent, attrs)
    },
  })
}
