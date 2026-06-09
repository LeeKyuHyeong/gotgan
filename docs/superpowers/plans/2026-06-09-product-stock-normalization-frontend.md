# 품목/재고 정규화 — 프런트엔드 재작성 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 백엔드 정규화(`product_group → product → stock`, `/api/items` 제거)에 맞춰 프런트를 재작성한다. 전체 재고를 그룹/품목 합산 트리로 보고, 위치 상세는 묶음 평면, "재고 추가"는 기존 품목 선택 또는 새 품목 생성, 편집은 묶음 단위로 한다.

**Architecture:** Vite + React 19 + TS + Tailwind v4 + React Query v5 + react-router v7. 기존 패턴 계승: axios 인스턴스(`api/client.ts`)가 토큰/`X-Household-Id` 자동 첨부, 오버레이형 피커(CategoryPicker/PresetPicker 패턴), 낙관적 +/- 조절. **타입 안전 게이트는 `npm run build`(=`tsc -b && vite build`)** — 프런트엔드엔 단위 테스트 인프라가 없으므로 타입체크 + 브라우저 수동 검증으로 보증.

**전제:** 백엔드 계획(`2026-06-09-product-stock-normalization-backend.md`)이 이미 구현·검증됨(같은 브랜치 `feat/product-stock-normalization`). 백엔드는 로컬 8083에서 `bootRun`으로 기동, 프런트는 `npm run dev`(5173, `/api`→8083 프록시)로 붙는다.

**확정된 UX 결정(사용자):**
1. 전체 재고 합산 트리에서 **품목이 묶음 1개뿐이면 그 품목행에서 바로 +/-**, 여러 묶음이면 펼쳐서 묶음별 +/-.
2. **기존 품목/그룹 편집(이름·단위·분류 수정, 재그룹, 그룹 이름변경/삭제)은 이번 범위 밖** — 백엔드 API가 없음. 품목 속성·그룹은 "재고 추가 시 새 품목"에서만 확정. 편집 화면은 묶음(수량/유통기한/메모/위치)만.

## 안전한 컷오버 전략 (각 커밋 `tsc` 통과)

타입/훅을 **추가 먼저, 제거 나중**: 신규 타입·훅을 기존 옆에 더하고(Task 1·2) → 페이지/컴포넌트를 신규 훅으로 재작성(Task 3~7) → 더 이상 참조 없을 때 구 훅/타입/컴포넌트 제거(Task 8). 이렇게 하면 중간 커밋도 빌드된다.

## 백엔드 응답 형태 (참조 — `api/types.ts`가 1:1 대응)

- `GET /api/inventory?q=` → `{ groups: Group[], ungrouped: Product[] }`
  - `Group = { groupId, groupName, totalQuantity, minDDay, expiringSoon, products: Product[] }`
  - `Product = { productId, name, unit, categoryId, categoryName, categoryEmoji, categoryColor, totalQuantity, minDDay, expiringSoon, batches: Stock[] }`
- `Stock`(=`StockResponse`) `= { id, productId, productName, unit, quantity, expiryDate, memo, locationId, locationName, locationEmoji, categoryId, categoryName, categoryEmoji, categoryColor, dDay, expiringSoon }`
- `GET /api/stock?locationId=` → `Stock[]`; `GET /api/stock/{id}` → `Stock`
- `POST /api/stock`(`CreateStockRequest`) → `Stock`; `PATCH /api/stock/{id}`(`UpdateStockRequest`) → `Stock`
- `POST /api/stock/{id}/adjust` `{delta}` → `Stock`; `DELETE /api/stock/{id}` → 204
- `GET /api/stock/{id}/history` → `HistoryResponse[]`
- `GET /api/products?q=` → `ProductPickerResponse[]` `= { id, name, unit, groupId, groupName, categoryId, categoryName }`
- `GET /api/product-groups` → `{ id, name }[]`
- `GET /api/history?page=` → `PageResponse<HistoryResponse>` (형태 불변; `itemId` 필드는 이제 stock id지만 화면은 `itemName`만 사용)
- `GET /api/home` → `HomeResponse` **불변**(HomePage 영향 없음, 단 FAB 경로만 갱신)

## File Structure

**수정:**
- `frontend/src/api/types.ts` — 신규 타입 추가(Task1), 구 타입 제거(Task8)
- `frontend/src/api/queries.ts` — 신규 훅 추가(Task2), 구 훅 제거(Task8)
- `frontend/src/pages/AllItemsPage.tsx` — 합산 트리로 재작성(Task5)
- `frontend/src/pages/LocationDetailPage.tsx` — 묶음 평면으로 재작성(Task6)
- `frontend/src/App.tsx` — 라우트 `/items/*`→`/stock/*`(Task7)
- `frontend/src/pages/HomePage.tsx` — FAB 경로(Task7)

**신규:**
- `frontend/src/components/StockRow.tsx` — 묶음 한 줄(+/- 조절·편집 이동)
- `frontend/src/components/InventoryProductRow.tsx` — 합산 품목행(단일=바로 조절, 다중=펼침)
- `frontend/src/components/ProductPicker.tsx` — 기존 품목 선택 오버레이
- `frontend/src/pages/StockAddPage.tsx` — 재고 추가(품목 선택/생성 + 위치·수량·기한·메모)
- `frontend/src/pages/StockEditPage.tsx` — 묶음 편집(수량/기한/메모/위치) + 이력 + 삭제

**삭제(Task8):**
- `frontend/src/components/ItemRow.tsx`
- `frontend/src/pages/ItemFormPage.tsx`

---

## Task 1: api/types.ts — 신규 타입 추가 (구 타입 유지)

**Files:** Modify `frontend/src/api/types.ts`

- [ ] **Step 1: 신규 타입 추가**

`api/types.ts` 맨 끝(기존 `CreateItemRequest`/`UpdateItemRequest` 아래)에 추가. **기존 `ItemResponse`/`CreateItemRequest`/`UpdateItemRequest`는 아직 지우지 않는다**(Task8에서 제거).

```ts
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
```

- [ ] **Step 2: 타입체크**

Run: `cd frontend && npm run build`
Expected: 성공(추가만 했으므로 기존 코드 영향 없음).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/types.ts
git commit -m "feat(fe): 재고 정규화 응답/요청 타입 추가"
```

---

## Task 2: api/queries.ts — 신규 훅 추가 (구 훅 유지)

**Files:** Modify `frontend/src/api/queries.ts`

- [ ] **Step 1: import에 신규 타입 추가**

`api/queries.ts` 상단 `import type { ... } from './types'` 목록에 추가:
```ts
  CreateStockRequest,
  InventoryResponse,
  ProductGroupResponse,
  ProductPickerResponse,
  StockResponse,
  UpdateStockRequest,
```

- [ ] **Step 2: 신규 훅 블록 추가**

기존 `// ---------- 아이템 ----------` 섹션은 **그대로 두고**, 그 아래에 새 섹션을 추가한다:

```ts
// ---------- 재고(stock) / 전체보기(inventory) / 품목(product) ----------

/** 전체 보기: 그룹/품목 합산 트리. */
export function useInventory(q?: string) {
  return useQuery({
    queryKey: ['inventory', q ?? ''],
    queryFn: async () =>
      (await api.get<InventoryResponse>('/api/inventory', { params: q ? { q } : undefined })).data,
  })
}

/** 위치 상세: 그 위치의 묶음 평면 목록. */
export function useLocationStock(locationId: number) {
  return useQuery({
    queryKey: ['locationStock', locationId],
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
    queryKey: ['products', q ?? ''],
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
    onSuccess: () => invalidateStockViews(qc),
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
      // 연타 끝났을 때만 합산/위치 뷰 재동기화(중간 깜빡임 방지)
      if (qc.isMutating({ mutationKey: ['adjustStock'] }) === 0) {
        qc.invalidateQueries({ queryKey: ['inventory'] })
        qc.invalidateQueries({ queryKey: ['locationStock'] })
        qc.invalidateQueries({ queryKey: ['home'] })
      }
    },
  })
}
```

- [ ] **Step 3: 타입체크 + Commit**

Run: `cd frontend && npm run build` → 성공.
```bash
git add frontend/src/api/queries.ts
git commit -m "feat(fe): inventory/stock/product 쿼리 훅 추가(낙관적 adjust 포함)"
```

---

## Task 3: StockRow 컴포넌트

**Files:** Create `frontend/src/components/StockRow.tsx`

- [ ] **Step 1: 작성**

```tsx
import { useNavigate } from 'react-router-dom'
import type { StockResponse } from '../api/types'
import { useAdjustStock } from '../api/queries'
import { tintBg } from '../lib/colors'
import { ExpiryBadge, Pill } from './ui'

/** 재고 묶음 한 줄. showLocation=true 면 위치 뱃지(합산 트리 펼침/전체에서). 탭→묶음 편집. */
export function StockRow({ stock, showLocation }: { stock: StockResponse; showLocation?: boolean }) {
  const navigate = useNavigate()
  const adjust = useAdjustStock()

  const sub = stock.expiryDate ? `~${stock.expiryDate.slice(5).replace('-', '/')}` : '기한 없음'

  return (
    <div className="flex items-center gap-3 border-b border-line py-3 last:border-none">
      <button
        onClick={() => navigate(`/stock/${stock.id}/edit`)}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <div
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-lg"
          style={{ backgroundColor: tintBg(stock.categoryColor) }}
        >
          {stock.categoryEmoji ?? '📦'}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[15px] font-semibold">{stock.productName}</span>
            <ExpiryBadge dDay={stock.dDay} />
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
            {showLocation && (
              <Pill tone="brand">
                {stock.locationEmoji} {stock.locationName}
              </Pill>
            )}
            <span>{sub}</span>
          </div>
        </div>
      </button>

      <div className="flex items-center gap-1.5">
        <button
          onClick={() => adjust.mutate({ stockId: stock.id, delta: -1 })}
          disabled={stock.quantity <= 0}
          className="h-7 w-7 rounded-full border border-line text-ink-soft disabled:opacity-40"
          aria-label="감소"
        >
          −
        </button>
        <span className="min-w-9 text-center text-sm font-bold tabular-nums">
          {Number(stock.quantity)}
          {stock.unit && <span className="ml-0.5 text-xs font-medium text-ink-soft">{stock.unit}</span>}
        </span>
        <button
          onClick={() => adjust.mutate({ stockId: stock.id, delta: 1 })}
          className="h-7 w-7 rounded-full border border-line text-ink-soft active:bg-line/40"
          aria-label="증가"
        >
          +
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 타입체크 + Commit**

Run: `cd frontend && npm run build` → 성공. (아직 미사용이지만 컴파일됨.)
```bash
git add frontend/src/components/StockRow.tsx
git commit -m "feat(fe): StockRow — 묶음 행(+/- 조절·편집 이동)"
```

---

## Task 4: InventoryProductRow 컴포넌트

**Files:** Create `frontend/src/components/InventoryProductRow.tsx`

- [ ] **Step 1: 작성**

단일 묶음 품목 → `StockRow` 하나로(품목행에서 바로 +/-). 다중 묶음 → 합산 헤더 + 펼침(묶음별 `StockRow`, 위치 표시).

```tsx
import { useState } from 'react'
import type { InventoryProduct } from '../api/types'
import { tintBg } from '../lib/colors'
import { ExpiryBadge } from './ui'
import { StockRow } from './StockRow'

/** 합산 품목행. 묶음 1개면 그 묶음 행을 바로 노출(품목행에서 +/-), 여러 개면 펼침 토글. */
export function InventoryProductRow({ product }: { product: InventoryProduct }) {
  const [open, setOpen] = useState(false)

  // 단일 묶음: 묶음 행 그대로(이름=품목명, 위치 표시 불필요)
  if (product.batches.length === 1) {
    return <StockRow stock={product.batches[0]} />
  }

  return (
    <div className="border-b border-line last:border-none">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 py-3 text-left"
      >
        <div
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-lg"
          style={{ backgroundColor: tintBg(product.categoryColor) }}
        >
          {product.categoryEmoji ?? '📦'}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[15px] font-semibold">{product.name}</span>
            <ExpiryBadge dDay={product.minDDay} />
          </div>
          <div className="mt-0.5 text-xs text-ink-soft">{product.batches.length}곳 · 펼쳐서 조절</div>
        </div>
        <span className="text-sm font-bold tabular-nums">
          {Number(product.totalQuantity)}
          {product.unit && <span className="ml-0.5 text-xs font-medium text-ink-soft">{product.unit}</span>}
        </span>
        <span className={`text-ink-soft transition-transform ${open ? 'rotate-90' : ''}`}>›</span>
      </button>

      {open && (
        <div className="pl-6">
          {product.batches.map((b) => (
            <StockRow key={b.id} stock={b} showLocation />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 타입체크 + Commit**

Run: `cd frontend && npm run build` → 성공.
```bash
git add frontend/src/components/InventoryProductRow.tsx
git commit -m "feat(fe): InventoryProductRow — 단일=바로조절, 다중=펼침"
```

---

## Task 5: AllItemsPage 재작성 (합산 트리)

**Files:** Modify `frontend/src/pages/AllItemsPage.tsx`

- [ ] **Step 1: 전체 교체**

그룹과 단독 품목을 `minDDay`(NULL 뒤) 기준으로 병합 정렬해 렌더. 그룹은 펼침 헤더 + 소속 품목행, 단독은 바로 `InventoryProductRow`.

```tsx
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useInventory } from '../api/queries'
import type { InventoryGroup, InventoryProduct } from '../api/types'
import { Fab, LoadingScreen, ExpiryBadge } from '../components/ui'
import { InventoryProductRow } from '../components/InventoryProductRow'
import { PullToRefresh } from '../components/PullToRefresh'

type Node =
  | { kind: 'group'; minDDay: number | null; group: InventoryGroup }
  | { kind: 'product'; minDDay: number | null; product: InventoryProduct }

export default function AllItemsPage() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const { data, isLoading, refetch } = useInventory(q.trim() || undefined)
  const [openGroups, setOpenGroups] = useState<Record<number, boolean>>({})

  // 그룹 + 단독 품목을 minDDay(NULL 뒤) 임박순으로 병합
  const nodes = useMemo<Node[]>(() => {
    if (!data) return []
    const list: Node[] = [
      ...data.groups.map((g) => ({ kind: 'group' as const, minDDay: g.minDDay, group: g })),
      ...data.ungrouped.map((p) => ({ kind: 'product' as const, minDDay: p.minDDay, product: p })),
    ]
    return list.sort((a, b) => {
      if (a.minDDay == null) return b.minDDay == null ? 0 : 1
      if (b.minDDay == null) return -1
      return a.minDDay - b.minDDay
    })
  }, [data])

  const count = nodes.length

  return (
    <PullToRefresh onRefresh={refetch}>
      <div className="min-h-screen px-5 pb-24">
        <header className="sticky top-0 z-10 bg-bg/90 pt-4 pb-2 backdrop-blur">
          <h1 className="mb-3 text-xl font-bold tracking-tight">전체 재고</h1>
          <div className="flex items-center gap-2 rounded-xl bg-line/50 px-3.5 py-2.5">
            <span className="text-ink-soft">🔍</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="품목 검색 (예: 우유, 맥주)"
              className="flex-1 bg-transparent text-sm outline-none"
            />
          </div>
        </header>

        {isLoading || !data ? (
          <LoadingScreen />
        ) : count === 0 ? (
          <p className="mt-16 text-center text-sm text-ink-soft">
            {q.trim() ? '검색 결과가 없어요.' : '아직 재고가 없어요.'}
          </p>
        ) : (
          <>
            <p className="mb-1 mt-1 text-xs text-ink-soft">{count}개 · 유통기한 임박순</p>
            {nodes.map((n) =>
              n.kind === 'product' ? (
                <InventoryProductRow key={`p${n.product.productId}`} product={n.product} />
              ) : (
                <GroupBlock
                  key={`g${n.group.groupId}`}
                  group={n.group}
                  open={!!openGroups[n.group.groupId]}
                  onToggle={() =>
                    setOpenGroups((o) => ({ ...o, [n.group.groupId]: !o[n.group.groupId] }))
                  }
                />
              ),
            )}
          </>
        )}

        <Fab onClick={() => navigate('/stock/new')} />
      </div>
    </PullToRefresh>
  )
}

function GroupBlock({
  group,
  open,
  onToggle,
}: {
  group: InventoryGroup
  open: boolean
  onToggle: () => void
}) {
  return (
    <div className="border-b border-line last:border-none">
      <button onClick={onToggle} className="flex w-full items-center gap-3 py-3 text-left">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-line/50 text-lg">
          🧺
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[15px] font-bold">{group.groupName}</span>
            <ExpiryBadge dDay={group.minDDay} />
          </div>
          <div className="mt-0.5 text-xs text-ink-soft">{group.products.length}종 · 묶음</div>
        </div>
        <span className="text-sm font-bold tabular-nums">{Number(group.totalQuantity)}</span>
        <span className={`text-ink-soft transition-transform ${open ? 'rotate-90' : ''}`}>›</span>
      </button>
      {open && (
        <div className="pl-6">
          {group.products.map((p) => (
            <InventoryProductRow key={p.productId} product={p} />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 타입체크 + Commit**

Run: `cd frontend && npm run build` → 성공.
```bash
git add frontend/src/pages/AllItemsPage.tsx
git commit -m "feat(fe): AllItemsPage — 그룹/품목 합산 트리"
```

---

## Task 6: LocationDetailPage 재작성 (묶음 평면)

**Files:** Modify `frontend/src/pages/LocationDetailPage.tsx`

- [ ] **Step 1: 전체 교체**

```tsx
import { useNavigate, useParams } from 'react-router-dom'
import { useLocationStock, useLocations } from '../api/queries'
import { AppHeader, Fab, LoadingScreen } from '../components/ui'
import { StockRow } from '../components/StockRow'
import { PullToRefresh } from '../components/PullToRefresh'

export default function LocationDetailPage() {
  const { id } = useParams()
  const locationId = Number(id)
  const navigate = useNavigate()
  const { data: locations } = useLocations()
  const { data: stocks, isLoading, refetch } = useLocationStock(locationId)
  const loc = locations?.find((l) => l.id === locationId)

  if (isLoading || !stocks) return <LoadingScreen />

  return (
    <PullToRefresh onRefresh={refetch}>
      <div className="min-h-screen px-5 pb-24">
        <AppHeader title={`${loc?.emoji ?? '📦'} ${loc?.name ?? '위치'}`} back />
        <p className="mb-1 text-xs text-ink-soft">{stocks.length}개 · 유통기한 임박순</p>

        {stocks.length === 0 ? (
          <p className="mt-16 text-center text-sm text-ink-soft">아직 재고가 없어요. ＋로 추가하세요.</p>
        ) : (
          stocks.map((s) => <StockRow key={s.id} stock={s} />)
        )}

        <Fab onClick={() => navigate(`/stock/new?locationId=${locationId}`)} />
      </div>
    </PullToRefresh>
  )
}
```

- [ ] **Step 2: 타입체크 + Commit**

Run: `cd frontend && npm run build` → 성공.
```bash
git add frontend/src/pages/LocationDetailPage.tsx
git commit -m "feat(fe): LocationDetailPage — 위치별 묶음 평면"
```

---

## Task 7: ProductPicker + StockAddPage + StockEditPage + 라우트

**Files:**
- Create `frontend/src/components/ProductPicker.tsx`
- Create `frontend/src/pages/StockAddPage.tsx`
- Create `frontend/src/pages/StockEditPage.tsx`
- Modify `frontend/src/App.tsx`, `frontend/src/pages/HomePage.tsx`

- [ ] **Step 1: ProductPicker (기존 품목 선택 오버레이)**

CategoryPicker/PresetPicker와 동일한 오버레이 패턴.

```tsx
import { useState } from 'react'
import { useProducts } from '../api/queries'
import type { ProductPickerResponse } from '../api/types'

interface Props {
  onPick: (product: ProductPickerResponse) => void
  onClose: () => void
}

/** 재고 있는 기존 품목 선택. 폼 상태 보존 위해 오버레이로 동작. */
export default function ProductPicker({ onPick, onClose }: Props) {
  const [q, setQ] = useState('')
  const { data: products } = useProducts(q.trim() || undefined)

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-black/30" onClick={onClose}>
      <div
        className="flex max-h-screen w-full max-w-[480px] flex-col bg-bg"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sticky top-0 flex items-center gap-3 bg-bg/90 px-4 pt-4 pb-2 backdrop-blur">
          <button onClick={onClose} className="text-2xl leading-none text-ink-soft" aria-label="닫기">
            ‹
          </button>
          <h1 className="text-xl font-bold tracking-tight">품목 선택</h1>
        </header>

        <div className="flex-1 overflow-y-auto px-5 pt-2 pb-8">
          <input
            className="w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-[15px] outline-none focus:border-brand"
            placeholder="🔍 품목 검색"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="mt-4 flex flex-col">
            {(products ?? []).map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  onPick(p)
                  onClose()
                }}
                className="flex items-center justify-between border-b border-line py-3 text-left last:border-none"
              >
                <span className="text-[15px] font-semibold">{p.name}</span>
                <span className="text-xs text-ink-soft">
                  {p.groupName && <span className="mr-2">🧺 {p.groupName}</span>}
                  {p.unit}
                </span>
              </button>
            ))}
            {products && products.length === 0 && (
              <p className="py-8 text-center text-sm text-ink-soft">
                재고 있는 품목이 없어요. 닫고 “새 품목”으로 추가하세요.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: StockAddPage (재고 추가)**

기존 품목 선택 ↔ 새 품목 생성 토글. 새 품목 모드는 프리셋(이름/단위/분류 자동채움) + 분류 피커 + 그룹(선택, datalist).

```tsx
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  useCategories,
  useCreateStock,
  useLocations,
  useProductGroups,
} from '../api/queries'
import type { CreateStockRequest, ProductPickerResponse } from '../api/types'
import { AppHeader, Button, ErrorText } from '../components/ui'
import CategoryPicker from '../components/CategoryPicker'
import PresetPicker from '../components/PresetPicker'
import ProductPicker from '../components/ProductPicker'
import { suggestPresets, type ItemPreset } from '../lib/presets'
import { errorMessage } from '../api/client'

const inputCls =
  'w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-[15px] outline-none focus:border-brand'
const labelCls = 'mb-1.5 block text-[13px] font-semibold text-ink-soft'

export default function StockAddPage() {
  const navigate = useNavigate()
  const [search] = useSearchParams()
  const { data: locations } = useLocations()
  const { data: categories } = useCategories()
  const { data: groups } = useProductGroups()
  const create = useCreateStock()

  // 품목 모드: 'existing'(기존 선택) | 'new'(새 품목)
  const [mode, setMode] = useState<'existing' | 'new'>('new')
  const [picked, setPicked] = useState<ProductPickerResponse | null>(null)

  // 새 품목 필드
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('')
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [groupName, setGroupName] = useState('')

  // 공통 묶음 필드
  const [locationId, setLocationId] = useState<number | ''>('')
  const [quantity, setQuantity] = useState('1')
  const [expiryDate, setExpiryDate] = useState('')
  const [memo, setMemo] = useState('')

  const [err, setErr] = useState<string | null>(null)
  const [catOpen, setCatOpen] = useState(false)
  const [presetOpen, setPresetOpen] = useState(false)
  const [productOpen, setProductOpen] = useState(false)

  // 기본 위치(쿼리파라미터 또는 첫 위치)
  useEffect(() => {
    if (locationId === '' && locations && locations.length > 0) {
      const fromQuery = Number(search.get('locationId'))
      setLocationId(fromQuery || locations[0].id)
    }
  }, [locations, search, locationId])

  const selectedCategory =
    categoryId === '' ? null : categories?.find((c) => c.id === categoryId) ?? null
  const suggestions = useMemo(() => suggestPresets(name), [name])

  function applyPreset(p: ItemPreset) {
    setName(p.name)
    const cat = categories?.find((c) => c.name === p.category)
    if (cat) setCategoryId(cat.id)
    if (p.unit && !unit.trim()) setUnit(p.unit)
  }

  function submit() {
    setErr(null)
    if (locationId === '') return setErr('위치를 선택하세요.')
    const qty = Number(quantity)
    if (!qty || qty <= 0) return setErr('수량은 0보다 커야 해요.')

    let productPart: Pick<CreateStockRequest, 'productId' | 'newProduct'>
    if (mode === 'existing') {
      if (!picked) return setErr('품목을 선택하세요.')
      productPart = { productId: picked.id }
    } else {
      if (!name.trim()) return setErr('품목 이름을 입력하세요.')
      // 그룹: 입력값이 기존 그룹 이름과 일치하면 groupId, 아니면 groupName(신규)
      const g = groupName.trim()
      const existing = groups?.find((x) => x.name === g)
      productPart = {
        newProduct: {
          name: name.trim(),
          unit: unit.trim() || null,
          categoryId: categoryId === '' ? null : Number(categoryId),
          groupId: existing ? existing.id : null,
          groupName: !existing && g ? g : null,
        },
      }
    }

    const body: CreateStockRequest = {
      ...productPart,
      locationId: Number(locationId),
      quantity: qty,
      expiryDate: expiryDate || null,
      memo: memo.trim() || null,
    }
    create.mutate(body, {
      onSuccess: () => navigate(-1),
      onError: (e) => setErr(errorMessage(e)),
    })
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader title="재고 추가" back />
      <div className="flex-1 space-y-4 px-5 pt-2">
        {/* 품목 모드 토글 */}
        <div className="flex rounded-xl border border-line p-1 text-sm font-semibold">
          <button
            type="button"
            onClick={() => setMode('existing')}
            className={`flex-1 rounded-lg py-2 ${mode === 'existing' ? 'bg-brand text-white' : 'text-ink-soft'}`}
          >
            기존 품목
          </button>
          <button
            type="button"
            onClick={() => setMode('new')}
            className={`flex-1 rounded-lg py-2 ${mode === 'new' ? 'bg-brand text-white' : 'text-ink-soft'}`}
          >
            새 품목
          </button>
        </div>

        {mode === 'existing' ? (
          <div>
            <label className={labelCls}>품목</label>
            <button
              type="button"
              onClick={() => setProductOpen(true)}
              className={`${inputCls} flex items-center justify-between text-left`}
            >
              <span className={picked ? '' : 'text-ink-soft'}>
                {picked ? `${picked.name}${picked.unit ? ` (${picked.unit})` : ''}` : '품목 선택'}
              </span>
              <span className="text-ink-soft">›</span>
            </button>
          </div>
        ) : (
          <>
            <div>
              <div className="mb-1.5 flex items-end justify-between">
                <label className="text-[13px] font-semibold text-ink-soft">품목 이름</label>
                <button
                  type="button"
                  onClick={() => setPresetOpen(true)}
                  className="text-[13px] font-semibold text-brand"
                >
                  자주 쓰는 품목 ›
                </button>
              </div>
              <input
                className={inputCls}
                value={name}
                placeholder="직접 입력하거나 자주 쓰는 품목에서 선택"
                onChange={(e) => setName(e.target.value)}
              />
              {suggestions.length > 0 && (
                <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
                  {suggestions.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => applyPreset(p)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] font-semibold text-ink"
                    >
                      <span>{p.emoji}</span> {p.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className={labelCls}>단위</label>
                <input
                  className={inputCls}
                  value={unit}
                  placeholder="팩, 개, 통…"
                  onChange={(e) => setUnit(e.target.value)}
                />
              </div>
              <div className="flex-1">
                <label className={labelCls}>분류</label>
                <button
                  type="button"
                  onClick={() => setCatOpen(true)}
                  className={`${inputCls} flex items-center justify-between text-left`}
                >
                  <span className={`flex items-center gap-1.5 ${selectedCategory ? '' : 'text-ink-soft'}`}>
                    {selectedCategory?.color && (
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: selectedCategory.color }} />
                    )}
                    {selectedCategory ? `${selectedCategory.emoji ?? ''} ${selectedCategory.name}` : '미분류'}
                  </span>
                  <span className="text-ink-soft">›</span>
                </button>
              </div>
            </div>
            <div>
              <label className={labelCls}>그룹 (선택 — 캔/병처럼 합산해 보고 싶을 때)</label>
              <input
                className={inputCls}
                value={groupName}
                placeholder="예: 맥주"
                list="group-options"
                onChange={(e) => setGroupName(e.target.value)}
              />
              <datalist id="group-options">
                {groups?.map((g) => <option key={g.id} value={g.name} />)}
              </datalist>
            </div>
          </>
        )}

        {/* 공통 묶음 필드 */}
        <div>
          <label className={labelCls}>위치</label>
          <select
            className={inputCls}
            value={locationId}
            onChange={(e) => setLocationId(Number(e.target.value))}
          >
            {locations?.map((l) => (
              <option key={l.id} value={l.id}>
                {l.emoji} {l.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className={labelCls}>수량</label>
            <input
              className={inputCls}
              type="number"
              inputMode="decimal"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <label className={labelCls}>유통기한</label>
            <input
              className={inputCls}
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>메모</label>
          <input className={inputCls} value={memo} onChange={(e) => setMemo(e.target.value)} />
        </div>
        <ErrorText message={err} />
      </div>

      <div className="px-5 pb-8 pt-2">
        <Button onClick={submit} disabled={create.isPending}>
          추가하기
        </Button>
      </div>

      {catOpen && (
        <CategoryPicker
          value={categoryId === '' ? null : categoryId}
          onChange={(id) => setCategoryId(id ?? '')}
          onClose={() => setCatOpen(false)}
        />
      )}
      {presetOpen && <PresetPicker onPick={applyPreset} onClose={() => setPresetOpen(false)} />}
      {productOpen && (
        <ProductPicker onPick={(p) => setPicked(p)} onClose={() => setProductOpen(false)} />
      )}
    </div>
  )
}
```

- [ ] **Step 3: StockEditPage (묶음 편집)**

품목 속성은 읽기전용(편집 API 없음). 묶음 수량/기한/메모/위치만 수정.

```tsx
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  useDeleteStock,
  useLocations,
  useStock,
  useStockHistory,
  useUpdateStock,
} from '../api/queries'
import { AppHeader, Button, ErrorText, LoadingScreen } from '../components/ui'
import { ACTION_LABEL, fmtDateTime } from '../lib/history'
import { errorMessage } from '../api/client'

const inputCls =
  'w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-[15px] outline-none focus:border-brand'
const labelCls = 'mb-1.5 block text-[13px] font-semibold text-ink-soft'

export default function StockEditPage() {
  const { id } = useParams()
  const stockId = Number(id)
  const navigate = useNavigate()
  const { data: locations } = useLocations()
  const { data: stock, isLoading } = useStock(stockId)
  const { data: history } = useStockHistory(stockId)
  const update = useUpdateStock(stockId)
  const del = useDeleteStock()

  const [locationId, setLocationId] = useState<number | ''>('')
  const [quantity, setQuantity] = useState('1')
  const [expiryDate, setExpiryDate] = useState('')
  const [memo, setMemo] = useState('')
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (stock) {
      setLocationId(stock.locationId)
      setQuantity(String(stock.quantity))
      setExpiryDate(stock.expiryDate ?? '')
      setMemo(stock.memo ?? '')
    }
  }, [stock])

  if (isLoading || !stock) return <LoadingScreen />

  function submit() {
    setErr(null)
    if (locationId === '') return setErr('위치를 선택하세요.')
    const qty = Number(quantity)
    if (qty < 0) return setErr('수량은 0보다 작을 수 없어요.')
    update.mutate(
      { quantity: qty, expiryDate: expiryDate || null, memo: memo.trim() || null, locationId: Number(locationId) },
      { onSuccess: () => navigate(-1), onError: (e) => setErr(errorMessage(e)) },
    )
  }

  function remove() {
    if (!confirm('이 재고를 삭제할까요?')) return
    del.mutate(stockId, { onSuccess: () => navigate(-1), onError: (e) => setErr(errorMessage(e)) })
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader title="재고 편집" back />
      <div className="flex-1 space-y-4 px-5 pt-2">
        <div>
          <label className={labelCls}>품목</label>
          <div className={`${inputCls} flex items-center justify-between bg-line/30`}>
            <span className="font-semibold">
              {stock.productName}
              {stock.unit && <span className="ml-1 text-ink-soft">({stock.unit})</span>}
            </span>
            <span className="text-[11px] text-ink-soft">품목 정보는 수정할 수 없어요</span>
          </div>
        </div>
        <div>
          <label className={labelCls}>위치</label>
          <select className={inputCls} value={locationId} onChange={(e) => setLocationId(Number(e.target.value))}>
            {locations?.map((l) => (
              <option key={l.id} value={l.id}>
                {l.emoji} {l.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className={labelCls}>수량</label>
            <input
              className={inputCls}
              type="number"
              inputMode="decimal"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <label className={labelCls}>유통기한</label>
            <input
              className={inputCls}
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>메모</label>
          <input className={inputCls} value={memo} onChange={(e) => setMemo(e.target.value)} />
        </div>
        <ErrorText message={err} />

        <div>
          <label className={labelCls}>변동 이력</label>
          <div className="overflow-hidden rounded-xl border border-line bg-surface">
            {!history ? (
              <p className="p-4 text-center text-xs text-ink-soft">불러오는 중…</p>
            ) : history.length === 0 ? (
              <p className="p-4 text-center text-xs text-ink-soft">아직 이력이 없어요.</p>
            ) : (
              history.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center gap-3 border-b border-line px-3.5 py-2.5 last:border-none"
                >
                  <span className="min-w-9 text-[13px] font-bold text-brand">{ACTION_LABEL[h.action]}</span>
                  <span className="truncate text-xs text-ink-soft">{h.userNickname ?? '누군가'}</span>
                  <span className="ml-auto whitespace-nowrap text-right">
                    {h.delta != null && (
                      <span className="text-[13px] font-semibold tabular-nums">
                        {h.delta > 0 ? '+' : ''}
                        {Number(h.delta)}
                        {h.quantityAfter != null && (
                          <span className="font-normal text-ink-soft"> → {Number(h.quantityAfter)}</span>
                        )}
                      </span>
                    )}
                    <span className="block text-[11px] text-ink-soft">{fmtDateTime(h.createdAt)}</span>
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2 px-5 pb-8">
        <Button onClick={submit} disabled={update.isPending}>
          저장
        </Button>
        <Button variant="danger" onClick={remove} disabled={del.isPending}>
          삭제
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 라우트 갱신 (App.tsx)**

`App.tsx`에서 `import ItemFormPage from './pages/ItemFormPage'`를 두 줄로 교체:
```tsx
import StockAddPage from './pages/StockAddPage'
import StockEditPage from './pages/StockEditPage'
```
그리고 라우트 두 줄을 교체:
```tsx
          <Route path="/stock/new" element={<StockAddPage />} />
          <Route path="/stock/:id/edit" element={<StockEditPage />} />
```
(기존 `/items/new`·`/items/:id/edit` 라우트 제거.)

- [ ] **Step 5: HomePage FAB 경로 갱신**

`HomePage.tsx`의 `<Fab onClick={() => navigate('/items/new')} label="아이템 추가" />` →
```tsx
      <Fab onClick={() => navigate('/stock/new')} label="재고 추가" />
```

- [ ] **Step 6: 타입체크 + Commit**

Run: `cd frontend && npm run build` → 성공. (이 시점엔 신규 페이지가 라우트에 연결되고, 구 ItemFormPage는 아직 존재하지만 라우트에서 빠짐.)
```bash
git add frontend/src/components/ProductPicker.tsx frontend/src/pages/StockAddPage.tsx frontend/src/pages/StockEditPage.tsx frontend/src/App.tsx frontend/src/pages/HomePage.tsx
git commit -m "feat(fe): 재고 추가/편집 화면 + 품목 피커 + 라우트(/stock)"
```

---

## Task 8: 구 코드 제거 + 정리

**Files:**
- Delete `frontend/src/components/ItemRow.tsx`, `frontend/src/pages/ItemFormPage.tsx`
- Modify `frontend/src/api/queries.ts`, `frontend/src/api/types.ts`

- [ ] **Step 1: 구 컴포넌트/페이지 삭제**

```bash
git rm frontend/src/components/ItemRow.tsx frontend/src/pages/ItemFormPage.tsx
```

- [ ] **Step 2: 구 훅 제거 (queries.ts)**

`api/queries.ts`에서 `// ---------- 아이템 ----------` 섹션의 다음 훅들을 통째로 삭제: `useItems`, `useItem`, `invalidateItemViews`, `useItemHistory`, `useCreateItem`, `useUpdateItem`, `patchCachedQuantity`, `useAdjustItem`, `useDeleteItem`. (`useHistory`는 이력 탭용이라 **유지**.) import 목록에서 `CreateItemRequest`, `ItemResponse`, `UpdateItemRequest`도 제거.

- [ ] **Step 3: 구 타입 제거 (types.ts)**

`api/types.ts`에서 `ItemResponse`, `CreateItemRequest`, `UpdateItemRequest` 인터페이스/타입 제거. (`HistoryResponse`, `PageResponse`는 유지.)

- [ ] **Step 4: 잔존 참조 확인**

Grep로 `useItems|useItem\b|useCreateItem|useUpdateItem|useAdjustItem|useDeleteItem|useItemHistory|ItemResponse|CreateItemRequest|UpdateItemRequest|ItemRow|ItemFormPage|/items/`가 `frontend/src`에 **0건**인지 확인. (BottomTabs 등에 `/items/` 링크가 있으면 `/stock/new`로 교체.)

- [ ] **Step 5: 빌드 + 린트**

Run: `cd frontend && npm run build` → 성공. 이어서 `npm run lint` → 신규 파일 관련 오류 0(미사용 import 등 정리).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(fe): 구 item 훅/타입/컴포넌트 제거(정규화 컷오버 마무리)"
```

---

## Task 9: 브라우저 수동 검증 (컨트롤러 수행)

> 단위 테스트 인프라가 없으므로 실제 브라우저로 확인. 백엔드(8083 `bootRun`)와 프런트(`npm run dev`, 5173)를 띄우고 로그인 후:

- [ ] 전체 재고: 그룹 펼침/접힘, 단독 품목, 단일 묶음 품목행에서 +/- 즉시 반영, 다중 묶음 품목 펼쳐 위치별 +/-. 검색(`q`) 동작.
- [ ] 위치 상세: 그 위치 묶음만 임박순. +/- 동작. ＋ → 재고 추가(위치 프리필).
- [ ] 재고 추가 — 기존 품목: 피커로 선택 → 같은 위치·기한이면 합산(INCREASE), 수량 증가 확인.
- [ ] 재고 추가 — 새 품목: 프리셋 적용(이름·단위·분류 채움), 그룹 이름 입력(기존 자동완성/신규), 추가 후 전체 재고에 반영.
- [ ] 편집: 수량/기한/메모/위치 변경 저장. 품목명 읽기전용 표시. 변동 이력 노출. 삭제 → 사라짐(0재고 cascade는 adjust로도 확인).
- [ ] 홈/이력 탭 정상(이력은 `itemName` 스냅샷 표시). 콘솔 에러 없음.

---

## Self-Review 체크리스트 (작성자 수행 완료)

- **스펙 커버리지:** 전체 보기 트리(Task5) / 위치 상세 묶음(Task6) / 재고 추가 품목선택·생성(Task7) / 묶음 편집(Task7) / 프리셋 계승(Task7 StockAddPage) / React Query 키·타입 갱신(Task1·2) — 모두 매핑됨.
- **UX 결정 반영:** 단일 묶음=품목행 +/-, 다중=펼침(InventoryProductRow Task4). 품목/그룹 편집 범위 밖 — 편집은 묶음만, 품목명 읽기전용(StockEditPage).
- **컷오버 안전:** 신규 추가(Task1~7) 동안 구 코드 유지 → 각 커밋 `tsc` 통과 → 마지막에 제거(Task8). 단, **Task7 Step4에서 라우트가 ItemFormPage를 더 이상 참조하지 않게 되므로 Task8 전까지 ItemFormPage는 죽은 채로 컴파일만 됨**(import는 App.tsx에서 빠짐) — 정상.
- **타입 일관성:** `StockResponse`/`InventoryProduct`/`InventoryGroup` 필드가 백엔드 DTO와 1:1. `useAdjustStock`는 `{stockId,delta}` 시그니처로 StockRow와 일치. `patchStockQty`가 inventory 중첩/locationStock/stock 캐시를 함께 갱신.
- **주의(실행자):** Task8 Step4 grep에서 BottomTabs·기타에 `/items/` 잔존 링크가 있으면 반드시 교체. `npm run build`는 `tsc -b`라 미사용 변수/타입 오류도 잡힘 — 각 Task에서 통과 확인.

## 비범위 / 후속
- 기존 품목 이름·단위·분류 수정, 재그룹, 그룹 이름변경/삭제 — 백엔드 API 부재로 이번 범위 밖(사용자 확정). 추후 `PATCH /api/products/{id}` + 그룹 관리 API와 함께 별도 계획.
- 백엔드 `HistoryResponse.itemId`(실제 stock id) 필드명 정리는 화면 미사용이라 보류(후속).
</content>
</invoke>
