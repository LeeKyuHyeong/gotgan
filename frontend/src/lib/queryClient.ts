import { QueryClient } from '@tanstack/react-query'

// 시안 결정: refetch on focus(열 때 항상 최신). pull-to-refresh/optimistic 은 화면에서.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      retry: 1,
      staleTime: 10_000,
    },
  },
})
