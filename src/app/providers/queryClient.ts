import { QueryClient } from '@tanstack/vue-query'

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5, // 5 分钟新鲜度
        gcTime: 1000 * 60 * 30,   // 30 分钟缓存回收
        retry: (failureCount, error: unknown) => {
          // 4xx 客户端异常不自动重试
          if (typeof error === 'object' && error !== null && 'status' in error) {
            const status = Number((error as { status: unknown }).status)
            if (status >= 400 && status < 500) return false
          }
          return failureCount < 2
        },
        refetchOnWindowFocus: true,
      },
      mutations: {
        retry: false,
      },
    },
  })
}
