import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import { getHouseholdId, setHouseholdId, setToken } from '../lib/auth'
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
  CreateLocationRequest,
  CreateStockRequest,
  HouseholdDetailResponse,
  RequestStatus,
  HistoryResponse,
  HomeResponse,
  HouseholdResponse,
  InventoryResponse,
  InviteResponse,
  LocationResponse,
  LoginResponse,
  MeResponse,
  PageResponse,
  ProductGroupResponse,
  ProductPickerResponse,
  StockResponse,
  UpdateLocationRequest,
  UpdateStockRequest,
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
      // ['me']는 이 시점에 비활성(구독자 없음)이라 refetchType: 'all' 없이는 stale 표시만 되고
      // 재조회가 안 됨 → 홈 진입 시 옛 needsOnboarding=true 캐시로 온보딩에 다시 갇히는 버그.
      // Promise를 반환해 재조회 완료 후에 페이지 이동(onSuccess 체인)이 일어나게 한다.
      return qc.invalidateQueries({ queryKey: ['me'], refetchType: 'all' })
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
      return qc.invalidateQueries({ queryKey: ['me'], refetchType: 'all' }) // 가구 생성과 동일한 이유
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
    queryKey: ['home', getHouseholdId()],
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
    queryKey: ['categoryRequests', getHouseholdId()],
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
    queryKey: ['locations', getHouseholdId()],
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
    queryKey: ['history', getHouseholdId(), page],
    queryFn: async () =>
      (await api.get<PageResponse<HistoryResponse>>('/api/history', { params: { page } })).data,
  })
}

// ---------- 재고(stock) / 전체보기(inventory) / 품목(product) ----------

/** 전체 보기: 그룹/품목 합산 트리. */
export function useInventory(q?: string) {
  return useQuery({
    queryKey: ['inventory', getHouseholdId(), q ?? ''],
    queryFn: async () =>
      (await api.get<InventoryResponse>('/api/inventory', { params: q ? { q } : undefined })).data,
  })
}

/** 위치 상세: 그 위치의 묶음 평면 목록. */
export function useLocationStock(locationId: number) {
  return useQuery({
    queryKey: ['locationStock', getHouseholdId(), locationId],
    queryFn: async () =>
      (await api.get<StockResponse[]>('/api/stock', { params: { locationId } })).data,
    enabled: !!locationId,
  })
}

/** 묶음 단건. */
export function useStock(stockId: number) {
  return useQuery({
    queryKey: ['stock', stockId],
    queryFn: async () => (await api.get<StockResponse>(`/api/stock/${stockId}`)).data,
    enabled: !!stockId,
  })
}

/** 묶음 변동 이력(편집 화면 인라인). */
export function useStockHistory(stockId: number) {
  return useQuery({
    queryKey: ['stockHistory', stockId],
    queryFn: async () =>
      (await api.get<HistoryResponse[]>(`/api/stock/${stockId}/history`)).data,
    enabled: !!stockId,
  })
}

/** 재고 있는 품목 picker. */
export function useProducts(q?: string) {
  return useQuery({
    queryKey: ['products', getHouseholdId(), q ?? ''],
    queryFn: async () =>
      (await api.get<ProductPickerResponse[]>('/api/products', { params: q ? { q } : undefined })).data,
  })
}

/** 그룹 picker. */
export function useProductGroups() {
  return useQuery({
    queryKey: ['productGroups'],
    queryFn: async () => (await api.get<ProductGroupResponse[]>('/api/product-groups')).data,
  })
}

function invalidateStockViews(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['inventory'] })
  qc.invalidateQueries({ queryKey: ['locationStock'] })
  qc.invalidateQueries({ queryKey: ['products'] })
  qc.invalidateQueries({ queryKey: ['productGroups'] })
  qc.invalidateQueries({ queryKey: ['home'] })
  qc.invalidateQueries({ queryKey: ['history'] })
}

export function useCreateStock() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: CreateStockRequest) =>
      (await api.post<StockResponse>('/api/stock', body)).data,
    onSuccess: () => invalidateStockViews(qc),
  })
}

export function useUpdateStock(stockId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: UpdateStockRequest) =>
      (await api.patch<StockResponse>(`/api/stock/${stockId}`, body)).data,
    onSuccess: () => {
      invalidateStockViews(qc)
      qc.invalidateQueries({ queryKey: ['stock', stockId] })
      qc.invalidateQueries({ queryKey: ['stockHistory', stockId] })
    },
  })
}

export function useDeleteStock() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (stockId: number) => {
      await api.delete(`/api/stock/${stockId}`)
    },
    onSuccess: (_, stockId) => {
      invalidateStockViews(qc)
      qc.invalidateQueries({ queryKey: ['stock', stockId] })
      qc.invalidateQueries({ queryKey: ['stockHistory', stockId] })
    },
  })
}

/** 캐시 즉시 반영: inventory 트리(묶음 찾아 수량+합계 갱신) + locationStock + stock 단건. */
function patchStockQty(qc: ReturnType<typeof useQueryClient>, stockId: number, delta: number) {
  qc.setQueriesData<InventoryResponse>({ queryKey: ['inventory'] }, (old) => {
    if (!old) return old
    const patchProduct = (p: InventoryResponse['ungrouped'][number]) => {
      let changed = false
      const batches = p.batches.map((b) => {
        if (b.id !== stockId) return b
        changed = true
        return { ...b, quantity: b.quantity + delta }
      })
      if (!changed) return p
      return { ...p, batches, totalQuantity: batches.reduce((s, b) => s + b.quantity, 0) }
    }
    return {
      groups: old.groups.map((g) => {
        const products = g.products.map(patchProduct)
        // 이 그룹에 해당 묶음이 없으면 동일 참조 유지(불필요한 리렌더 방지)
        if (products.every((p, i) => p === g.products[i])) return g
        return { ...g, products, totalQuantity: products.reduce((s, p) => s + p.totalQuantity, 0) }
      }),
      ungrouped: old.ungrouped.map(patchProduct),
    }
  })
  qc.setQueriesData<StockResponse[]>({ queryKey: ['locationStock'] }, (old) =>
    old?.map((s) => (s.id === stockId ? { ...s, quantity: s.quantity + delta } : s)),
  )
  qc.setQueryData<StockResponse>(['stock', stockId], (old) =>
    old ? { ...old, quantity: old.quantity + delta } : old,
  )
}

/** 수량 +/- (낙관적). 결과 0이면 서버가 묶음 소프트삭제 → onSettled 재조회로 사라짐. */
export function useAdjustStock() {
  const qc = useQueryClient()
  return useMutation({
    mutationKey: ['adjustStock'],
    mutationFn: async ({ stockId, delta }: { stockId: number; delta: number }) =>
      (await api.post<StockResponse>(`/api/stock/${stockId}/adjust`, { delta })).data,
    onMutate: async ({ stockId, delta }) => {
      await qc.cancelQueries({ queryKey: ['inventory'] })
      await qc.cancelQueries({ queryKey: ['locationStock'] })
      await qc.cancelQueries({ queryKey: ['stock', stockId] })
      patchStockQty(qc, stockId, delta)
      return { stockId, delta }
    },
    onError: (_e, vars, ctx) => {
      const c = ctx ?? vars
      patchStockQty(qc, c.stockId, -c.delta)
    },
    onSettled: (_d, _e, vars) => {
      qc.invalidateQueries({ queryKey: ['history'] })
      qc.invalidateQueries({ queryKey: ['stockHistory', vars.stockId] })
      qc.invalidateQueries({ queryKey: ['stock', vars.stockId] })
      // 연타 중 "마지막 settle"에서만 합산/위치 뷰 재동기화(중간 깜빡임 방지).
      // 주의: onSettled는 이 뮤테이션이 'success'로 전이되기 전에 실행되므로 isMutating은
      // 자기 자신을 포함(최소 1) → "내가 마지막"은 ===0 이 아니라 <=1 로 판정해야 한다(===0은 영원히 거짓).
      if (qc.isMutating({ mutationKey: ['adjustStock'] }) <= 1) {
        qc.invalidateQueries({ queryKey: ['inventory'] })
        qc.invalidateQueries({ queryKey: ['locationStock'] })
        qc.invalidateQueries({ queryKey: ['home'] })
      }
    },
  })
}
