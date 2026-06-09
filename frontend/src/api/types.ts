// 백엔드 DTO와 1:1 대응하는 타입

export type UserRole = 'USER' | 'SYSTEM_ADMIN'
export type MembershipRole = 'OWNER' | 'MEMBER'
export type ItemAction = 'CREATE' | 'INCREASE' | 'DECREASE' | 'UPDATE' | 'DELETE'

export interface UserDto {
  id: number
  nickname: string | null
  profileImageUrl: string | null
  role: UserRole
}

export interface HouseholdSummary {
  householdId: number
  name: string
  myRole: MembershipRole
}

export interface LoginResponse {
  accessToken: string
  expiresInSeconds: number
  user: UserDto
  households: HouseholdSummary[]
  needsOnboarding: boolean
}

export interface MeResponse {
  user: UserDto
  households: HouseholdSummary[]
  needsOnboarding: boolean
}

export interface HouseholdResponse {
  id: number
  name: string
  myRole: MembershipRole
  inviteCode: string | null
  memberCount: number
  maxMembers: number
}

export interface MemberResponse {
  userId: number
  nickname: string | null
  role: MembershipRole
}

export interface InviteResponse {
  inviteCode: string
  memberCount: number
  maxMembers: number
  members: MemberResponse[]
}

export interface HouseholdDetailResponse {
  id: number
  name: string
  myRole: MembershipRole
  inviteCode: string | null // 가족장만
  ownerUserId: number
  memberCount: number
  maxMembers: number
  members: MemberResponse[]
}

export interface CategoryResponse {
  id: number
  name: string
  emoji: string | null
  color: string | null
}

export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED'
export type CategoryStatus = 'ACTIVE' | 'HIDDEN'

export interface CategoryRequestResponse {
  id: number
  requestedName: string
  suggestedEmoji: string | null
  status: RequestStatus
  resolvedCategoryName: string | null
  createdAt: string
}

export interface LocationResponse {
  id: number
  name: string
  emoji: string | null
  sortOrder: number
}

export interface LocationCardResponse {
  id: number
  name: string
  emoji: string | null
  sortOrder: number
  itemCount: number
  expiringSoonCount: number
}

export interface HomeResponse {
  totalItemCount: number
  expiringSoonCount: number
  locations: LocationCardResponse[]
}

export interface ItemResponse {
  id: number
  name: string
  quantity: number
  unit: string | null
  expiryDate: string | null // ISO date 'yyyy-MM-dd'
  memo: string | null
  locationId: number
  locationName: string
  locationEmoji: string | null
  categoryId: number | null
  categoryName: string | null
  categoryEmoji: string | null
  categoryColor: string | null
  dDay: number | null
  expiringSoon: boolean
}

export interface HistoryResponse {
  id: number
  itemId: number
  itemName: string
  action: ItemAction
  delta: number | null
  quantityAfter: number | null
  userNickname: string | null
  createdAt: string
}

export interface PageResponse<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  hasNext: boolean
}

// 요청 바디
export interface CreateLocationRequest {
  name: string
  emoji?: string | null
}
export interface UpdateLocationRequest {
  name: string
  emoji?: string | null
  sortOrder?: number | null
}

export interface CreateCategoryRequestRequest {
  name: string
  emoji?: string | null
}

// ----- 어드민 (SYSTEM_ADMIN) -----
export interface AdminStatsResponse {
  pendingRequests: number
  totalCategories: number
  totalHouseholds: number
}

export interface AdminCategoryRequestResponse {
  id: number
  requestedName: string
  suggestedEmoji: string | null
  status: RequestStatus
  requesterNickname: string | null
  householdName: string | null
  sameNameCount: number
  createdAt: string
}

export interface AdminCategoryResponse {
  id: number
  name: string
  emoji: string | null
  color: string | null
  sortOrder: number
  status: CategoryStatus
}

export interface ApproveRequestRequest {
  name?: string | null
  emoji?: string | null
  color?: string | null
  sortOrder?: number | null
}

export interface AdminCreateCategoryRequest {
  name: string
  emoji?: string | null
  color?: string | null
  sortOrder?: number | null
}

export interface AdminUpdateCategoryRequest {
  name?: string | null
  emoji?: string | null
  color?: string | null
  sortOrder?: number | null
  status?: CategoryStatus
}

export interface CreateItemRequest {
  name: string
  locationId: number
  categoryId?: number | null
  quantity: number
  unit?: string | null
  expiryDate?: string | null
  memo?: string | null
}
export type UpdateItemRequest = CreateItemRequest

// ===== 재고 정규화 (stock/product/inventory) =====

export interface StockResponse {
  id: number
  productId: number
  productName: string
  unit: string | null
  quantity: number
  expiryDate: string | null // 'yyyy-MM-dd'
  memo: string | null
  locationId: number
  locationName: string
  locationEmoji: string | null
  categoryId: number | null
  categoryName: string | null
  categoryEmoji: string | null
  categoryColor: string | null
  dDay: number | null
  expiringSoon: boolean
}

export interface InventoryProduct {
  productId: number
  name: string
  unit: string | null
  categoryId: number | null
  categoryName: string | null
  categoryEmoji: string | null
  categoryColor: string | null
  totalQuantity: number
  minDDay: number | null
  expiringSoon: boolean
  batches: StockResponse[]
}

export interface InventoryGroup {
  groupId: number
  groupName: string
  totalQuantity: number
  minDDay: number | null
  expiringSoon: boolean
  products: InventoryProduct[]
}

export interface InventoryResponse {
  groups: InventoryGroup[]
  ungrouped: InventoryProduct[]
}

export interface ProductPickerResponse {
  id: number
  name: string
  unit: string | null
  groupId: number | null
  groupName: string | null
  categoryId: number | null
  categoryName: string | null
}

export interface ProductGroupResponse {
  id: number
  name: string
}

export interface NewProductInput {
  name: string
  unit?: string | null
  categoryId?: number | null
  groupId?: number | null
  groupName?: string | null
}

// productId 또는 newProduct 중 정확히 하나(폼·백엔드에서 런타임 검증; 폼의 Pick<> 구성 단순화를 위해 둘 다 optional 유지)
export interface CreateStockRequest {
  productId?: number | null
  newProduct?: NewProductInput | null
  locationId: number
  quantity: number
  expiryDate?: string | null
  memo?: string | null
}

export interface UpdateStockRequest {
  quantity: number
  expiryDate?: string | null
  memo?: string | null
  locationId: number
}
