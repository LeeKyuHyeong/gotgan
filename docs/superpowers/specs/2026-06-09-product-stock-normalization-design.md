# 품목/재고 정규화 설계 — 곳간(gotgan)

- 작성일: 2026-06-09
- 상태: 승인됨 (브레인스토밍 합의 완료, 구현 계획 대기)
- 범위: 백엔드 도메인/스키마/API 재설계 + 운영 데이터 마이그레이션 + 프런트 아이템 기능 재작성

## 배경 / 문제

현재 `item` 엔티티는 `household + location + category + name + quantity + unit + expiry_date + memo`를
한 행에 담은 **평평한 구조**다. 그 결과:

1. 같은 가구에서 같은 품목(예: 맥주)이 서로 다른 위치(냉장고/뒷베란다)에 있으면 **별개 행**으로
   잡히고, "전체" 보기에서 합산되지 않는다.
2. 맥주의 캔/병, 소주의 팩/유리병/플라스틱병 같은 **규격(변형)**을 표현할 구조가 없다.

목표: 품목 정의를 분리하고 위치별 수량을 재고로 두는 정규화로 (1) 위치를 가로질러 같은 품목을
합산해 보고, (2) 규격을 그룹으로 묶어 본다.

## 핵심 결정 (브레인스토밍 합의)

| # | 결정 | 선택 |
|---|------|------|
| 품목 동일성 | 합산의 기준 | **명시적 선택/생성** (이름 입력도 기존 품목과 같으면 재사용) |
| 규격(캔/병) | 계층 구조 | **2계층 + 선택적 그룹** (품목=구체 단위, 그 위에 optional 그룹) |
| 유통기한 묶음 | 같은 품목·위치에 유통기한 다른 묶음 | **묶음(batch) 허용** (현재 동작 유지, D-3 정확) |
| 0재고 처리 | 다 소진되면 | **품목도 삭제** (단, 이력 보존 위해 내부 소프트삭제 + 재생성 시 되살리기) |
| 운영 데이터 | 기존 item | **마이그레이션 보존** (item_legacy로 백업) |

## 데이터 모델

3계층, 모두 가구(household) 범위. 멀티테넌트 격리는 기존과 동일하게 `household_id` 수동 격리.

```
product_group  (선택적 그룹: 맥주, 소주)
  └ product    (품목 = 재고 단위: 맥주 캔)
      └ stock  (재고 묶음/batch)
```

### product_group (품목 그룹) — 신규
- `id`, `household_id`(FK), `name`(VARCHAR 50), `sort_order`, `deleted_at`(소프트삭제), `created_at`, `updated_at`
- 유니크: `(household_id, name)` — 소프트삭제 행 포함 단일 보장(재생성 시 되살리기로 충돌 회피)
- 용도: 맥주 캔/병처럼 여러 품목을 합산 표시할 때만 사용. 선택적(품목이 그룹 없이 존재 가능).

### product (품목) — 신규 (재고 단위)
- `id`, `household_id`(FK), `product_group_id`(FK, nullable), `category_id`(FK, nullable),
  `name`(VARCHAR 100), `unit`(VARCHAR 20, nullable), `sort_order`, `deleted_at`, `created_at`, `updated_at`
- 유니크: `(household_id, name)` — 소프트삭제 포함 단일
- `unit`·`category`는 기존 item에서 **품목 레벨로 이동**. (규격이 다르면 다른 품목 → 단위도 자연히 분리)
- 사용자가 명시적으로 선택/생성하는 단위. 같은 이름은 항상 하나로 모임 → 위치 가로지른 합산이 성립.

### stock (재고 묶음/batch) — 신규 (실재고)
- `id`, `household_id`(FK, 격리/조회 편의용 비정규화), `product_id`(FK), `location_id`(FK),
  `quantity`(DECIMAL 10,2), `expiry_date`(DATE, nullable), `memo`(VARCHAR 255, nullable),
  `deleted_at`, `created_at`, `updated_at`
- `(product_id, location_id, expiry_date)`당 하나의 묶음을 의도. 같은 3요소(둘 다 null 포함)면 합산,
  유통기한이 다르면 새 묶음.
- 인덱스: `(household_id, deleted_at)`, `(location_id, deleted_at)`, `(household_id, expiry_date)`(D-3 알림)

### item_history (변동 이력) — 수정
- 기존 `item_id` → `stock_id`로 재배선 (FK는 stock).
- `item_name_snapshot`은 유지(품목 이름 스냅샷). 묶음/품목이 소프트삭제돼도 이력은 이름으로 읽힘.
- action enum(`CREATE/INCREASE/DECREASE/UPDATE/DELETE`)·delta·quantity_after 의미 그대로.

### category / storage_location — 변경 없음
- `category`는 전역 공통(색상 포함), `storage_location`은 가구 범위 그대로.
- 단, `item`이 참조하던 FK들은 `product`(category) / `stock`(location)으로 옮겨감.

## 동작 규칙

### 재고 추가 (POST /api/stock)
입력: `productId`(기존 선택) **또는** 새 품목 `{name, unit, categoryId, groupId? | groupName?}`
       + `locationId`, `quantity`, `expiryDate?`, `memo?`

1. 품목 해석:
   - `productId` 주어지면 그대로 사용(가구 소유 검증).
   - 새 품목이면: 같은 가구에 같은 `name`의 **활성 또는 소프트삭제** product가 있으면 **재사용/되살리기**,
     없으면 신규 생성. `groupName`이 주어졌고 같은 이름 그룹이 없으면 그룹도 생성/되살리기.
2. 묶음 해석:
   - 같은 `(product, location, expiry_date)`의 활성 묶음이 있으면 **수량 합산**.
   - 없으면 새 묶음 생성. (소프트삭제된 동일 묶음이 있으면 되살려 합산)
3. 이력 기록: `CREATE`(신규 묶음) 또는 `INCREASE`(합산), delta·quantity_after 기록.

### 수량 증감 (POST /api/stock/{id}/adjust) · 편집 · 삭제
- adjust(+/-): 결과 음수 거부. 결과가 **0이면 그 묶음 소프트삭제** + cascade 정리(아래).
- PATCH: 수량/유통기한/메모/위치 변경. 위치·유통기한 변경 시 동일 묶음 합산 규칙 재적용 가능(구현 단순화를 위해 1차 구현은 단순 갱신, 합치기 충돌은 새 묶음 유지로 처리 — 계획 단계에서 확정).
- DELETE: 묶음 소프트삭제 + cascade 정리.

### Cascade 정리 (0재고 → 품목/그룹 삭제)
묶음이 소프트삭제될 때:
1. 해당 product의 **활성 묶음이 0개**면 product 소프트삭제.
2. 해당 product_group의 **활성 product가 0개**면 group 소프트삭제.
- 모두 소프트삭제(하드삭제 아님) → 이력 FK 보존. 화면에선 `deleted_at IS NULL` 필터로 완전히 사라짐.
- 같은 이름 재생성 시 소프트삭제 행을 되살려(유니크 `(household, name)` 충돌 회피) 이력·그룹 연결 유지.

## 조회 / 화면

### 전체 보기 — GET /api/inventory?q=
그룹/품목 합산 트리. 응답은 그룹 단위(그룹 없는 품목은 단독)로:
```
맥주  5 ▼              ← product_group, 합산 수량
 · 맥주 캔  3  (냉장고 1 · D-? , 뒷베란다 2)
 · 맥주 병  2  (냉장고 2)
우유  1                ← 그룹 없는 품목 단독
```
- 정렬: 가장 임박한 유통기한 우선(현재 정책 계승), 그룹 내 품목은 이름/정렬순.
- 각 품목의 집계: `sum(quantity)`, `min(expiry_date)`(가장 임박), 위치·묶음 펼침 데이터.
- `q`(검색): 품목 이름 기준 필터.

### 위치 상세 — GET /api/stock?locationId=
그 위치의 묶음 평면 목록(현재 LocationDetailPage와 유사). 유통기한 임박순.

### D-3 만료 알림 (배치)
- 기존 `findAllExpiringForNotify`를 stock 기준으로: 활성 stock 중 `expiry_date BETWEEN today AND today+3`,
  product/household join, 가구별 묶음 발송. (현재 정확도·문구 유지)

## API 표면 (기존 /api/items 대체)

| 메서드 | 경로 | 용도 |
|--------|------|------|
| GET | `/api/inventory?q=` | 전체 보기(그룹/품목 합산 트리) |
| GET | `/api/stock?locationId=` | 위치 상세(묶음 평면) |
| GET | `/api/stock/{id}` | 묶음 단건 |
| POST | `/api/stock` | 재고 추가(품목 선택/생성 + 묶음 합산/생성) |
| PATCH | `/api/stock/{id}` | 묶음 편집 |
| POST | `/api/stock/{id}/adjust` | 수량 +/- |
| DELETE | `/api/stock/{id}` | 묶음 삭제 |
| GET | `/api/stock/{id}/history` | 묶음 변동 이력 |
| GET | `/api/products?q=` | 재고 있는 품목 picker |
| GET | `/api/product-groups` | 그룹 picker |

- 기존 `/api/items` 및 `ItemController/ItemService`는 제거(또는 위 구조로 대체). `HistoryController`는
  가구 전체 이력 목록 유지(스냅샷 기반이라 영향 적음).

## 프런트엔드 영향

- **AllItemsPage** → 그룹→품목→묶음 트리(펼침). `ItemRow`는 품목 합산 행 + 펼침 묶음 행으로 분화.
- **LocationDetailPage** → 위치별 묶음 평면(현재와 유사, stock 응답에 맞춤).
- **ItemFormPage** → "재고 추가": 품목 선택(기존) 또는 새 품목 생성(이름·단위·분류·그룹) + 위치·수량·유통기한·메모.
  편집 화면은 묶음 단위.
- **프리셋 198개**: 새 품목 생성 시 이름·단위·분류 자동 채움으로 유지(현재 PresetPicker 흐름 계승).
- React Query 키/쿼리(`useItems` 등)와 `api/queries.ts`, `api/client.ts` 타입 갱신.

## 마이그레이션 (Flyway V6)

운영(gotgan.kyuhyeong.com) 실데이터 보존. 단일 마이그레이션으로:

1. `product_group`, `product`, `stock` 테이블 생성.
2. 기존 `item`(활성·소프트삭제 포함)에서:
   - `(household_id, name, COALESCE(unit,''), category_id)` 단위로 묶어 `product` 생성
     (같은 묶음 → 하나의 product). `product_group_id`는 NULL(초기엔 그룹 없음).
   - 각 item 행을 `stock`으로 이전: `product_id`(위에서 만든), `location_id`, `quantity`, `expiry_date`,
     `memo`, `deleted_at`(원본 유지). `household_id` 비정규화 채움.
3. `item_history.item_id`를 새 `stock.id`로 재매핑(원본 item→stock 1:1 매핑 테이블/조인 활용).
   - 매핑 보장을 위해 마이그레이션 중 임시 컬럼(`item.migrated_stock_id`)을 두고 채운 뒤 history 업데이트.
4. `item` → `item_legacy`로 rename(즉시 드롭하지 않음, 롤백 안전망). `item_history` FK는 stock으로 교체.
5. 검증 쿼리: item 수 == stock 수, history 행 수 불변, 합계 수량 보존.

> 마이그레이션은 SQL만으로 복잡(그룹핑·매핑)하므로, 필요 시 V6는 스키마 생성 + Java `JdbcTemplate`
> 기반 데이터 이관 단계(별도 `@Component` 1회 실행 또는 Flyway Java migration)로 분리할 수 있음. 계획 단계에서 확정.

## 테스트

- 단위: 재고 추가(신규/합산/유통기한 분리), 같은 이름 재사용·되살리기, adjust 0 → cascade 정리(품목·그룹),
  inventory 합산/정렬, 위치 상세, D-3 알림 쿼리.
- 마이그레이션: 샘플 item 세트 → product/stock/history 매핑 정확성, 수량·이력 보존, item_legacy 잔존.
- 테넌트 격리: 새 쿼리 전부 `household_id` 수동 격리 확인(기존 주의사항 계승).

## 비범위 (YAGNI)

- 그룹의 자동 추론(이름에서 캔/병 떼어내기 등) — 사용자가 수동으로 그룹 지정.
- 품목 카탈로그 영속화(0재고여도 품목 보존) — 결정상 0재고 시 삭제이므로 안 함.
- 다단계(3계층 초과) 위치/그룹 — 평평한 1단계 유지.
- 사진 첨부 등 기존 드롭 결정 유지.

## 미해결 / 계획 단계에서 확정할 것

1. 마이그레이션을 순수 SQL V6로 갈지, Java 기반 이관 단계로 분리할지.
2. PATCH로 위치/유통기한 변경 시 동일 묶음 합치기를 할지(1차: 단순 갱신).
3. inventory 응답 DTO 형태(중첩 트리 vs 평면 + groupId) 최종 확정.
