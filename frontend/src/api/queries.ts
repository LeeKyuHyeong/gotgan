import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import { setHouseholdId, setToken } from '../lib/auth'
import type {
  AdminCategoryRequestResponse,
  AdminCategoryResponse,
  AdminCreateCategoryRequest,
  AdminStatsResponse,
  AdminUpdateCategoryRequest,
  ApproveRequestRequest,
  CategoryRequestResponse,
  CategoryResponse,
  CreateCategoryRequestRequest,
  CreateItemRequest,
  CreateLocationRequest,
  HouseholdDetailResponse,
  RequestStatus,
  HistoryResponse,
  HomeResponse,
  HouseholdResponse,
  InviteResponse,
  ItemResponse,
  LocationResponse,
  LoginResponse,
  MeResponse,
  PageResponse,
  UpdateItemRequest,
  UpdateLocationRequest,
} from './types'

// ---------- 인증 / 온보딩 ----------
export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => (await api.get<MeResponse>('/api/me')).data,
  })
}

export function useUpdateMe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: { nickname: string }) =>
      (await api.patch<MeResponse>('/api/me', body)).data,
    onSuccess: (data) => qc.setQueryData(['me'], data),
  })
}

export function useDevLogin() {
  return useMutation({
    mutationFn: async (body: { kakaoId: string; nickname?: string }) =>
      (await api.post<LoginResponse>('/api/auth/dev-token', body)).data,
    onSuccess: (data) => setToken(data.accessToken),
  })
}

export function useKakaoLogin() {
  return useMutation({
    mutationFn: async (body: { code: string; redirectUri?: string }) =>
      (await api.post<LoginResponse>('/api/auth/kakao', body)).data,
    onSuccess: (data) => setToken(data.accessToken),
  })
}

export function useCreateHousehold() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: { name: string }) =>
      (await api.post<HouseholdResponse>('/api/households', body)).data,
    onSuccess: (data) => {
      setHouseholdId(data.id)
      qc.invalidateQueries({ queryKey: ['me'] })
    },
  })
}

export function useJoinHousehold() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: { inviteCode: string }) =>
      (await api.post<HouseholdResponse>('/api/households/join', body)).data,
    onSuccess: (data) => {
      setHouseholdId(data.id)
      qc.invalidateQueries({ queryKey: ['me'] })
    },
  })
}

// ---------- 가구 관리 ----------
export function useHousehold(householdId: number) {
  return useQuery({
    queryKey: ['household', householdId],
    queryFn: async () =>
      (await api.get<HouseholdDetailResponse>(`/api/households/${householdId}`)).data,
    enabled: !!householdId,
  })
}

export function useRenameHousehold(householdId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: { name: string }) =>
      (await api.patch<HouseholdDetailResponse>(`/api/households/${householdId}`, body)).data,
    onSuccess: (data) => {
      qc.setQueryData(['household', householdId], data)
      qc.invalidateQueries({ queryKey: ['me'] })
    },
  })
}

export function useKickMember(householdId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (userId: number) => {
      await api.delete(`/api/households/${householdId}/members/${userId}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['household', householdId] })
      qc.invalidateQueries({ queryKey: ['invite', householdId] })
    },
  })
}

export function useTransferOwnership(householdId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (userId: number) =>
      (await api.post<HouseholdDetailResponse>(`/api/households/${householdId}/transfer`, { userId })).data,
    onSuccess: (data) => {
      qc.setQueryData(['household', householdId], data)
      qc.invalidateQueries({ queryKey: ['me'] })
      qc.invalidateQueries({ queryKey: ['invite', householdId] })
    },
  })
}

export function useLeaveHousehold(householdId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await api.post(`/api/households/${householdId}/leave`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  })
}

export function useDeleteHousehold(householdId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await api.delete(`/api/households/${householdId}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  })
}

export function useInvite(householdId: number) {
  return useQuery({
    queryKey: ['invite', householdId],
    queryFn: async () =>
      (await api.get<InviteResponse>(`/api/households/${householdId}/invite`)).data,
    enabled: !!householdId,
  })
}

export function useRegenerateInvite(householdId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () =>
      (await api.post<InviteResponse>(`/api/households/${householdId}/invite/regenerate`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invite', householdId] }),
  })
}

// ---------- 홈 / 분류 / 위치 ----------
export function useHome() {
  return useQuery({
    queryKey: ['home'],
    queryFn: async () => (await api.get<HomeResponse>('/api/home')).data,
  })
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => (await api.get<CategoryResponse[]>('/api/categories')).data,
    staleTime: 5 * 60_000,
  })
}

// ---------- 분류 추가 요청 ----------
export function useCategoryRequests() {
  return useQuery({
    queryKey: ['categoryRequests'],
    queryFn: async () =>
      (await api.get<CategoryRequestResponse[]>('/api/category-requests')).data,
  })
}

export function useCreateCategoryRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: CreateCategoryRequestRequest) =>
      (await api.post<CategoryRequestResponse>('/api/category-requests', body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categoryRequests'] }),
  })
}

export function useLocations() {
  return useQuery({
    queryKey: ['locations'],
    queryFn: async () => (await api.get<LocationResponse[]>('/api/locations')).data,
  })
}

function invalidateLocationViews(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['locations'] })
  qc.invalidateQueries({ queryKey: ['home'] })
}

export function useCreateLocation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: CreateLocationRequest) =>
      (await api.post<LocationResponse>('/api/locations', body)).data,
    onSuccess: () => invalidateLocationViews(qc),
  })
}

export function useUpdateLocation(locationId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: UpdateLocationRequest) =>
      (await api.patch<LocationResponse>(`/api/locations/${locationId}`, body)).data,
    onSuccess: () => invalidateLocationViews(qc),
  })
}

export function useDeleteLocation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (locationId: number) => {
      await api.delete(`/api/locations/${locationId}`)
    },
    onSuccess: () => invalidateLocationViews(qc),
  })
}

// ---------- 아이템 ----------
export function useItems(params?: { locationId?: number; q?: string }) {
  return useQuery({
    queryKey: ['items', params ?? {}],
    queryFn: async () =>
      (await api.get<ItemResponse[]>('/api/items', { params })).data,
  })
}

export function useItem(itemId: number) {
  return useQuery({
    queryKey: ['item', itemId],
    queryFn: async () => (await api.get<ItemResponse>(`/api/items/${itemId}`)).data,
    enabled: !!itemId,
  })
}

function invalidateItemViews(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['items'] })
  qc.invalidateQueries({ queryKey: ['home'] })
  qc.invalidateQueries({ queryKey: ['history'] })
  qc.invalidateQueries({ queryKey: ['itemHistory'] })
}

/** 특정 아이템의 변동 이력(최신순). 편집 화면 인라인 표시용. */
export function useItemHistory(itemId: number) {
  return useQuery({
    queryKey: ['itemHistory', itemId],
    queryFn: async () =>
      (await api.get<HistoryResponse[]>(`/api/items/${itemId}/history`)).data,
    enabled: !!itemId,
  })
}

export function useCreateItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: CreateItemRequest) =>
      (await api.post<ItemResponse>('/api/items', body)).data,
    onSuccess: () => invalidateItemViews(qc),
  })
}

export function useUpdateItem(itemId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: UpdateItemRequest) =>
      (await api.patch<ItemResponse>(`/api/items/${itemId}`, body)).data,
    onSuccess: () => {
      invalidateItemViews(qc)
      qc.invalidateQueries({ queryKey: ['item', itemId] })
    },
  })
}

/** 캐시된 모든 아이템 목록/상세의 수량에 delta를 즉시 반영(낙관적 갱신·롤백 공용). */
function patchCachedQuantity(qc: ReturnType<typeof useQueryClient>, itemId: number, delta: number) {
  qc.setQueriesData<ItemResponse[]>({ queryKey: ['items'] }, (old) =>
    old?.map((it) => (it.id === itemId ? { ...it, quantity: it.quantity + delta } : it)),
  )
  qc.setQueryData<ItemResponse>(['item', itemId], (old) =>
    old ? { ...old, quantity: old.quantity + delta } : old,
  )
}

export function useAdjustItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ['adjustItem'],
    mutationFn: async ({ itemId, delta }: { itemId: number; delta: number }) =>
      (await api.post<ItemResponse>(`/api/items/${itemId}/adjust`, { delta })).data,
    // 낙관적: 클릭 즉시 화면 반영, 진행 중 refetch는 취소해 덮어쓰기 방지
    onMutate: async ({ itemId, delta }) => {
      await qc.cancelQueries({ queryKey: ['items'] })
      await qc.cancelQueries({ queryKey: ['item', itemId] })
      patchCachedQuantity(qc, itemId, delta)
      return { itemId, delta }
    },
    onError: (_e, vars, ctx) => {
      const c = ctx ?? vars
      patchCachedQuantity(qc, c.itemId, -c.delta) // 실패 시 되돌리기
    },
    // 연타 중에는 마지막 증감만 서버값과 동기화 (중간값 깜빡임 방지). 이력은 항상 갱신.
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: ['history'] })
      qc.invalidateQueries({ queryKey: ['itemHistory', vars.itemId] })
      qc.invalidateQueries({ queryKey: ['item', vars.itemId] })
      if (qc.isMutating({ mutationKey: ['adjustItem'] }) === 0) {
        qc.invalidateQueries({ queryKey: ['items'] })
      }
    },
  })
}

export function useDeleteItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (itemId: number) => {
      await api.delete(`/api/items/${itemId}`)
    },
    onSuccess: () => invalidateItemViews(qc),
  })
}

// ---------- 어드민 (SYSTEM_ADMIN) ----------
function invalidateAdminViews(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['adminStats'] })
  qc.invalidateQueries({ queryKey: ['adminRequests'] })
  qc.invalidateQueries({ queryKey: ['adminCategories'] })
  qc.invalidateQueries({ queryKey: ['categories'] }) // 사용자 분류 선택에도 반영
}

export function useAdminStats() {
  return useQuery({
    queryKey: ['adminStats'],
    queryFn: async () => (await api.get<AdminStatsResponse>('/api/admin/stats')).data,
  })
}

export function useAdminRequests(status: RequestStatus = 'PENDING') {
  return useQuery({
    queryKey: ['adminRequests', status],
    queryFn: async () =>
      (await api.get<AdminCategoryRequestResponse[]>('/api/admin/category-requests', { params: { status } })).data,
  })
}

export function useApproveRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, body }: { id: number; body: ApproveRequestRequest }) =>
      (await api.post<AdminCategoryResponse>(`/api/admin/category-requests/${id}/approve`, body)).data,
    onSuccess: () => invalidateAdminViews(qc),
  })
}

export function useRejectRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.post(`/api/admin/category-requests/${id}/reject`)
    },
    onSuccess: () => invalidateAdminViews(qc),
  })
}

export function useAdminCategories() {
  return useQuery({
    queryKey: ['adminCategories'],
    queryFn: async () => (await api.get<AdminCategoryResponse[]>('/api/admin/categories')).data,
  })
}

export function useAdminCreateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: AdminCreateCategoryRequest) =>
      (await api.post<AdminCategoryResponse>('/api/admin/categories', body)).data,
    onSuccess: () => invalidateAdminViews(qc),
  })
}

export function useAdminUpdateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, body }: { id: number; body: AdminUpdateCategoryRequest }) =>
      (await api.patch<AdminCategoryResponse>(`/api/admin/categories/${id}`, body)).data,
    onSuccess: () => invalidateAdminViews(qc),
  })
}

export function useAdminDeleteCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/api/admin/categories/${id}`)
    },
    onSuccess: () => invalidateAdminViews(qc),
  })
}

// ---------- 이력 ----------
export function useHistory(page = 0) {
  return useQuery({
    queryKey: ['history', page],
    queryFn: async () =>
      (await api.get<PageResponse<HistoryResponse>>('/api/history', { params: { page } })).data,
  })
}
