# 곳간 — 백엔드/DB 스키마

> 대상: MariaDB, DB명 `stock`, charset **utf8mb4**(이모지 저장 필수). 포트: 로컬 3306 / 운영 3312(외부 관리용).
> **실제 스키마는 Flyway가 소유·적용**: `backend/src/main/resources/db/migration/V1~V9`(+ V7은 Java 마이그레이션 `backend/src/main/java/db/migration`).
> 이 폴더의 `01_schema.sql` 등은 초기 참조용 — V6 정규화 이후 최신본은 마이그레이션이 진실. 스택: Spring Boot 4 · Java 17 · 패키지 `com.kh.stock`.

---

## 1. ER 개요 (V6 정규화 후 — 품목 3계층)

```
app_user ──< membership >── household ──< storage_location ──┐
   │                            │                            │
   │                            ├──< product_group ──< product ──< stock >──┐
   │                            │                         ▲                 │
   │                            │                    category(전역)          │
   │                            ├──< category_request >── category           │
   │                            └──< push_subscription                       │
   └──────────────────────< item_history >─────────────────────────────────┘
                          (user · household · stock 참조 + 이름 스냅샷)
```

- **전역(테넌트 무관)**: `app_user`, `category`
- **가구 범위(멀티테넌트)**: `household`, `membership`, `storage_location`, `product_group`, `product`, `stock`, `item_history`, `category_request`, `push_subscription` — 전부 `household_id` 보유
- **품목 3계층**: `product_group`(선택, 합산용 묶음) → `product`(품목 정의: 이름·단위·분류) → `stock`(실제 재고 묶음: 위치·수량·유통기한). 구 `item` 테이블은 V8에서 `item_legacy`로 백업 rename(롤백 안전망, 현재 미사용).

---

## 2. 테이블 요약

| 테이블 | 역할 | 핵심 포인트 |
|---|---|---|
| `app_user` | 카카오 로그인 사용자 | `kakao_id` 유니크. `role` = **USER / SYSTEM_ADMIN**(플랫폼 운영자). role 변경은 즉시 반영(인증 필터가 DB에서 live 해석) |
| `household` | 가구(테넌트) | `owner_user_id`=가족장, `invite_code` 상시 1개(유니크), `max_members`(기본 4) |
| `membership` | user↔household | `role` = **OWNER / MEMBER**. (user, household) 유니크 |
| `storage_location` | 보관 위치 | `emoji`·`sort_order`. **소프트삭제**(`deleted_at`, V9). 구성원 누구나 편집 |
| `category` | **전역 공통 분류** | 운영자 마스터. `emoji`·`color`(V3)·`status` ACTIVE/HIDDEN |
| `category_request` | 분류 추가 요청 | 커뮤니티 요청 → 운영자 승인 시 `resolved_category_id` 연결 |
| `product_group` | 품목 묶음(선택) | 합산 표시용(예: 맥주=캔+병). `uq(household_id, name)`. 소프트삭제 |
| `product` | 품목 정의 | `name`·`unit`·`category_id`(nullable)·`product_group_id`(nullable). `uq(household_id, name)`. 소프트삭제 |
| `stock` | 재고 묶음 | `product_id`·`location_id`·`quantity` DECIMAL(10,2)·`expiry_date`·`memo`. 소프트삭제. 수량 0 → 소프트삭제 |
| `item_history` | 변동 이력 | `stock_id`(V8 재배선)·`user_id`·`action`·`delta`·`quantity_after`·`item_name_snapshot`(당시 이름 보존) |
| `push_subscription` | Web Push 구독 | V4. VAPID 표준. 410 응답 시 자동 정리 |

> **role 두 종류 주의**: `app_user.role`=*플랫폼 권한*(어드민 웹), `membership.role`=*가구 내 권한*(가족장). 분리 유지.

---

## 3. 확정된 설계 결정

1. **분류는 전역 공통 목록** — 가구별 커스텀 아님. 없으면 `category_request`로 요청 → 운영자 승인 시 모든 가구 공통 노출.
2. **분류·위치에 이모지**, **분류에 색상**(V3, 목록 틴트/폼 색점).
3. **곧 만료 = D-3** — 컬럼 아님, 쿼리/서비스에서 계산(`expiry_date BETWEEN 오늘 AND 오늘+3`). 기준존 `Asia/Seoul` 명시(`LocationService`/`ExpiryPushScheduler`).
4. **알림**: 인앱 배지 + **Web Push**(V4, 매일 9시 KST D-3 요약). 인앱 브라우저는 푸시 미지원.
5. **위치 편집 권한 = 구성원 누구나** — 별도 권한 컬럼 불필요.
6. **소프트 삭제 전반** — `stock`/`product`/`product_group`/`storage_location` 전부 `deleted_at`. 목록 조회는 `WHERE deleted_at IS NULL`. 이력 무결성·FK(RESTRICT) 보호 목적(위치 하드삭제가 잔존 FK로 막히던 문제를 V9 소프트삭제로 해소).
7. **초대코드 = 상시 1개 + 재발급** — `household.invite_code` 덮어쓰기. 6자 영숫자(혼동문자 제외). 합류 시 `max_members` 초과 체크(비관락).
8. **품목 정규화(V6)** — 입력은 `product_id`(기존) XOR `newProduct`(새 품목). 새 품목은 `groupId`(기존 그룹) 또는 `groupName`(새 그룹) 선택.

---

## 4. 멀티테넌트 데이터 격리 (★ 가장 중요)

> 멀티테넌트 버그의 99%는 격리 누락. **새 쿼리 추가 시 `household_id` 필터를 반드시 직접 챙길 것**(stock/product/group/location 전부).

**현재 구현(실제)** — Hibernate `@Filter`는 **채택 안 함**(기능 추가 계획 없어 회귀방지 실익 낮음, 서비스 수동 격리 유지):

1. **인증 필터**(`JwtAuthenticationFilter`) — `Authorization: Bearer <jwt>`에서 userId 파싱 후 DB에서 사용자/role을 live 해석(삭제·강등 즉시 반영).
2. **요청당 현재 가구 확정**(`TenantInterceptor`) — `X-Household-Id` 헤더가 있으면 해당 사용자의 `membership` 존재를 **반드시 검증**(없으면 403, 위조 차단) 후 `TenantContext`(ThreadLocal)에 세팅. 헤더 없으면 비움(/api/me·온보딩 등 가구 불필요 경로).
3. **서비스 계층 격리** — 모든 가구 범위 쿼리가 `TenantContext.require()`로 현재 가구를 받아 `household_id` 직접 필터링. 단건 조회는 `requireOwned*`로 소유·소프트삭제 여부까지 검증.
4. **쓰기 가드 + 동시성** — 수량 증감/합류 경합은 비관락(`findByIdForUpdate`)으로 lost-update·정원 초과 방지.
5. 규모가 작아 단일 DB + `household_id` 컬럼으로 충분(샤딩 불필요).

---

## 5. 권한 매트릭스

| 동작 | MEMBER | OWNER(가족장) | SYSTEM_ADMIN(운영자) |
|---|:--:|:--:|:--:|
| 재고/품목 CRUD · 수량 증감 · 위치 편집 | ✅ | ✅ | — |
| 멤버 초대·코드 재발급·내보내기 | ❌ | ✅ | — |
| 가구 이름 변경 / 가족장 넘기기 / 가구 삭제 | ❌ | ✅ | — |
| 분류 추가 **요청** | ✅ | ✅ | — |
| 분류 승인·공통목록 관리 | ❌ | ❌ | ✅ (어드민 웹) |

---

## 6. JPA 매핑 메모

- enum은 `@Enumerated(EnumType.STRING)` ↔ DB `VARCHAR`.
- `created_at/updated_at` → `@CreationTimestamp`/`@UpdateTimestamp`. 연관은 전부 `LAZY` + `open-in-view: false`.
- `stock.quantity`·`item_history.delta` → `BigDecimal`(DTO에 `@Digits(8,2)`로 DECIMAL(10,2) 범위 강제).
- 소프트삭제는 `@SQLDelete`/`@Where`가 아니라 **서비스에서 `deleted_at` 세팅 + 조회 시 `DeletedAtIsNull` 파생쿼리**(@Filter 미채택과 일관).
- `ddl-auto: validate` — 스키마는 Flyway 소유, JPA는 검증만.

---

## 7. 접속 정보

| 환경 | 포트 | 프로파일 | 비고 |
|---|---|---|---|
| **local** | **3306** | (기본) | local 3306 = **MySQL 8.0**(운영 3312만 MariaDB) |
| **prod** | **3312** | `prod` | 운영 DB (앱→DB는 컨테이너명 `gotgan-db:3306`, 3312는 DBeaver 외부접속 전용) |

```
local JDBC : jdbc:mariadb://localhost:3306/stock?characterEncoding=utf8mb4&serverTimezone=Asia/Seoul
DB         : stock   (utf8mb4 / utf8mb4_unicode_ci)
자격증명     : 환경변수 DB_USERNAME / DB_PASSWORD (local 기본 root/1234)
```

> ⚠️ DB가 utf8mb4가 아니면 이모지(분류/위치) 저장이 깨짐. 확인: `SELECT @@character_set_database;` → `utf8mb4`.

---

## 8. 마이그레이션 이력

| 버전 | 내용 |
|---|---|
| V1 | 초기 스키마(구 8테이블) |
| V2 | 공통 분류 시드 |
| V3 | `category.color` |
| V4 | `push_subscription`(Web Push) |
| V5 | 공통 분류 '곡물·면'(🌾) 추가 |
| V6 | **품목/재고 3계층 정규화**(`product_group`·`product`·`stock`) |
| V7 | (Java) 구 `item` → `stock` 데이터 이행 |
| V8 | `item_history` FK를 item→stock 재배선 + `item`→`item_legacy` 백업 rename |
| V9 | `storage_location.deleted_at`(위치 소프트삭제) |

> 정리 후보: `item_legacy` 테이블 + `stock.migrated_stock_id`(V6/V8 롤백 안전망) — 운영 안정 확인 후 드롭 가능.
