# 곳간 — 백엔드/DB 스키마 (확정안)

> 대상: MariaDB, DB명 `stock`, charset **utf8mb4**(이모지 저장 필수). 포트: 로컬 3306 / 운영 3312(외부 관리용).
> 이 폴더의 SQL은 **참조용** — 실제 스키마는 Flyway(`backend/src/main/resources/db/migration/V1~V3`)가 소유·적용.
> DDL: [`01_schema.sql`](01_schema.sql) · 시드: [`02_seed_categories.sql`](02_seed_categories.sql) · 셋업: [`00_setup.sql`](00_setup.sql)

---

## 1. ER 개요

```
app_user ──< membership >── household ──< storage_location ──< item >── category
   │                            │                                │         ▲
   │                            └──< category_request >──────────┘─────────┘
   └──────────────< item_history >── item
```

- **전역(테넌트 무관)**: `app_user`, `category`
- **가구 범위(멀티테넌트)**: `household`, `membership`, `storage_location`, `item`, `item_history`, `category_request` — 전부 `household_id` 보유

---

## 2. 테이블 요약

| 테이블 | 역할 | 핵심 포인트 |
|---|---|---|
| `app_user` | 카카오 로그인 사용자 | `kakao_id` 유니크. `role` = **USER / SYSTEM_ADMIN**(플랫폼 운영자) |
| `household` | 가구(테넌트) | `owner_user_id`=가족장, `invite_code` 상시 1개(유니크), `max_members`(기본 4) |
| `membership` | user↔household | `role` = **OWNER(가족장) / MEMBER**. (user, household) 유니크 |
| `storage_location` | 보관 위치 | `emoji` 직접 선택, `sort_order` 변경. 구성원 누구나 편집 |
| `category` | **전역 공통 분류** | 운영자 관리 마스터. `emoji` 보유. `status` ACTIVE/HIDDEN |
| `category_request` | 분류 추가 요청 | 커뮤니티 요청 → 운영자 승인 시 `resolved_category_id` 연결 |
| `item` | 재고 아이템 | `quantity` DECIMAL(소수 허용), `expiry_date`, **소프트 삭제**(`deleted_at`) |
| `item_history` | 변동 이력 | 누가/언제/`action`/`delta`/`quantity_after`/이름 스냅샷 |

> **role 두 종류 주의**: `app_user.role`은 *플랫폼 권한*(어드민 웹 접근), `membership.role`은 *가구 내 권한*(가족장). 시안 1번 결정대로 "관리자 탭" 없이 분리.

---

## 3. 확정된 설계 결정 (시안 논의 반영)

1. **분류는 전역 공통 목록** — 가구별 커스텀 아님. 정해진 목록에서 선택, 없으면 `category_request`로 요청 → 운영자가 어드민에서 승인하면 모든 가구에 공통 노출. *(시안 2번)*
2. **분류·위치에 이모지** — `category.emoji`, `storage_location.emoji`. *(시안 2·3번)*
3. **곧 만료 = D-3** — 컬럼이 아니라 **쿼리에서 계산**: `expiry_date BETWEEN CURDATE() AND CURDATE() + INTERVAL 3 DAY`. 임박순 정렬은 `ORDER BY expiry_date ASC`(+ `idx_item_expiry`). *(시안 4번)*
4. **인앱 배지 only(v1)** — 외부 푸시(SMS/웹푸시/알림톡)는 DB 영향 없음, v1 제외. 배지 카운트는 위 곧만료 쿼리로 산출.
5. **위치 편집 권한 = 구성원 누구나** — 별도 권한 컬럼 불필요(멤버십만 있으면 가능). *(시안 ⑤)*
6. **소프트 삭제** — 아이템 삭제 시 `deleted_at`만 채워 이력(`item_id` FK) 무결성 유지. 목록 조회는 `WHERE deleted_at IS NULL`.
7. **초대코드 = 상시 1개 + 재발급** — `household.invite_code` 덮어쓰기. 형식 6~8자 영숫자(O/0, I/1 제외). 합류 시 `max_members` 초과 체크.

---

## 4. 멀티테넌트 데이터 격리 (★ 가장 중요)

> 멀티테넌트 버그의 99%는 격리 누락. `WHERE household_id=?`를 손으로 붙이지 말고 **한 곳에서 강제**.

권장 구현(가계부앱 방식 재사용):

1. **요청당 현재 가구 확정** — `currentHouseholdId`를 결정해 `TenantContext`(ThreadLocal/RequestScope)에 저장.
   - **다가구 허용(확정)**: 한 사용자가 여러 가구에 가입 가능. 현재 가구는 `X-Household-Id` 헤더로 지정하고, 서버가 해당 사용자의 `membership` 존재를 **반드시 검증**. 멤버십이 1개뿐이면 헤더 없을 때 그 가구로 폴백. 프론트엔 가구 전환 UI 필요.
2. **Hibernate `@Filter`** — 가구 범위 엔티티에 `@FilterDef(name="tenant", parameters=@ParamDef(name="hid", type=Long))` + `@Filter(condition="household_id = :hid")`. 매 요청 인터셉터에서 `session.enableFilter("tenant").setParameter("hid", currentHouseholdId)`.
3. **쓰기 가드** — 저장/수정 시 엔티티의 `household_id`가 현재 가구와 일치하는지 서비스 계층에서 한 번 더 확인(필터는 읽기 보호이므로).
4. 규모가 작아 단일 DB + `household_id` 컬럼으로 충분(샤딩 불필요).

---

## 5. 권한 매트릭스

| 동작 | MEMBER | OWNER(가족장) | SYSTEM_ADMIN(운영자) |
|---|:--:|:--:|:--:|
| 아이템 CRUD / 위치 편집 | ✅ | ✅ | — |
| 멤버 초대·코드 재발급·내보내기 | ❌ | ✅ | — |
| 가구 이름 변경 / 가족장 넘기기 / 가구 삭제 | ❌ | ✅ | — |
| 분류 추가 **요청** | ✅ | ✅ | — |
| 분류 승인·공통목록 관리 | ❌ | ❌ | ✅ (어드민 웹) |

---

## 6. JPA 매핑 메모 (다음 단계용)

- enum은 `@Enumerated(EnumType.STRING)` ↔ DB의 `VARCHAR + CHECK` 와 1:1.
- `created_at/updated_at` → `@CreationTimestamp` / `@UpdateTimestamp` 또는 JPA Auditing.
- `item.quantity/history.delta` → `BigDecimal`.
- 소프트삭제 → `@SQLDelete`(UPDATE set deleted_at) + `@Where("deleted_at is null")` 또는 위 `@Filter`와 조합.
- 마이그레이션은 **Flyway** 권장: `01_schema.sql`→`V1__init.sql`, `02_seed_categories.sql`→`V2__seed_categories.sql` 로 이관. (운영 반영 추적 용이)

---

## 7. 접속 정보

| 환경 | 포트 | 프로파일 | 비고 |
|---|---|---|---|
| **local** | **3306** | (기본) | 개발 PC에 `stock` DB 생성 완료 |
| **prod** | **3312** | `prod` | 운영 DB, 추후 함께 생성 |

```
local JDBC : jdbc:mariadb://localhost:3306/stock?characterEncoding=utf8mb4&serverTimezone=Asia/Seoul
prod  JDBC : jdbc:mariadb://localhost:3312/stock  (application-prod.yml)
DB         : stock   (utf8mb4 / utf8mb4_unicode_ci)
자격증명     : 환경변수 DB_USERNAME / DB_PASSWORD 로 주입 (기본 username=root, password 빈값)
```

> ⚠️ local DB가 utf8mb4가 아니면 이모지(분류/위치) 저장이 깨집니다.
> 확인: `SELECT @@character_set_database;` → `utf8mb4` 여야 함.
> 아니면: `ALTER DATABASE stock CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`

---

## 8. 결정 로그 / 남은 항목

확정:
- [x] **사진 첨부 → v1 제외** (스키마에 image 컬럼 없음. 추후 `item.image_url` + 스토리지로 추가 가능)
- [x] **다가구 허용** — 한 사용자가 여러 가구 가입. 현재 가구는 `X-Household-Id` 헤더(§4).
- [x] 빌드 스택 → **Gradle + Java 17** (Spring Boot 3.x), 패키지 `com.kh.stock`

남음(나중에 결정해도 됨):
- [ ] 분류에 **색상**도 줄지 (지금은 이모지만)
- [ ] `unit`을 자유 텍스트로 둘지 / 프리셋 제공할지 (지금은 자유 텍스트)
