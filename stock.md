# stock.md — 곳간(우리집 재고) 설계 문서

> 가족(부부) 단위 **집안 재고 확인** 모바일 반응형 웹앱.
> 본인 + 예비 신부로 시작, 추후 친구 부부 가구로 확장 가능.
> 앱 이름 **곳간** 확정 — 운영: https://gotgan.kyuhyeong.com
> 작업 현황은 [`TODO.md`](TODO.md), 인프라는 [`server-infra-stock.md`](server-infra-stock.md) 참고. 이 문서는 초기 설계 결정의 기록.

---

## 1. 확정된 핵심 결정

| 항목 | 결정 | 비고 |
|---|---|---|
| 3D | **제외** | 위치를 공간이 아닌 '분류(필터)'로 처리. 3D는 작업량 대비 가치 낮아 드롭 (집 모델링이 가장 큰 비용이었음) |
| 멀티테넌트 | **가구(household) 단위** | 가계부앱 family-unit 구조 거의 그대로 재사용 |
| 과금 | **전부 무료 (free)** | 결제/구독 레이어 없음. 재고앱엔 유료화 포인트가 없음. (가계부앱은 별도로 결제 유지) |
| 인증 | **카카오 소셜 로그인 단독** | ID/PW · 아이디 찾기 · 비번 찾기 · 이메일 인증 전부 제거. 신원관리는 카카오가 담당 |
| 실시간 | **"열 때 항상 최신" 기준** | 진짜 푸시 대신 React Query(refetch on focus + pull-to-refresh + optimistic). 모바일은 백그라운드 시 연결 끊겨서 푸시가 어차피 불안정 |

### 배제/보류한 것 (이유)
- **WebSocket**: 양방향 불필요 → SSE로 충분(쓴다면).
- **공통 멀티테넌트 모듈 추출**: 앱 2개(가계부+재고)일 땐 복사가 정답. 3번째 앱 나오면 그때 추출 (Simplicity First, 불필요한 추상화 지양).
- **위치 계층 구조**(큰방 > 옷장 > 서랍): v1은 평평하게(1단계). 필요하면 v2 이후.

---

## 2. 기술 스택
- Frontend: **React** (모바일 우선 반응형)
- Backend: **Spring Boot**
- DB: **MariaDB**
- 데이터/상태: **React Query (TanStack Query)** — refetch on focus, pull-to-refresh, optimistic update
- (선택) **SSE** — 둘 다 앱 켜놨을 때 '살아있는' 느낌까지 원하면 가구 단위로 이벤트 push. 대시보드에서 쓰던 패턴 재사용. *도입 여부 미정.*

---

## 3. 데이터 모델 (초안)

> 변수/필드명은 영어. 모든 조회는 `household_id`로 필터링.

| 엔티티 | 주요 필드 | 메모 |
|---|---|---|
| `Household` (가구) | id, name, ownerId, inviteCode, createdAt | 테넌트 단위 |
| `Membership` | id, userId, householdId, role(owner/member) | user ↔ household 연결 |
| `StorageLocation` | id, name, sortOrder, householdId | **enum 아님 → 테이블.** 추가/수정/순서변경 가능 (큰방, 화장실, 냉장고, 거실...) |
| `Item` | id, name, category, quantity, unit, expiryDate, locationId, householdId | location당 1개 위치(FK) |
| `ItemHistory` (변동 이력) | id, itemId, userId, action, delta, createdAt | 누가/언제 넣고 뺐는지 (2인 사용이라 은근 중요) |

### 데이터 격리 (중요)
- 멀티테넌트 버그의 99%는 격리 누락에서 발생.
- `WHERE household_id = ?`를 쿼리마다 손으로 붙이지 말고 **한 곳에서 강제**: Hibernate `@Filter` / base repository / 서비스 계층 가드 중 택1. 가계부앱 방식 그대로 가져오기.
- 규모: 친구 부부 몇 쌍 = 아주 작음. 샤딩 등 불필요, `household_id` 컬럼 하나로 거르는 단일 DB로 충분.

---

## 4. 화면 (지금까지)

### 진입/온보딩
1. **로그인** — "카카오로 시작하기" 단일 버튼. 신규/기존은 서버가 판단(없으면 온보딩, 있으면 홈).
2. **가구 설정 (온보딩, 신규 유저만)** — 두 갈래:
   - **새 가구 만들기** (기본 경로) → *내 경로*
   - **초대코드로 합류** (코드 입력) → *예비 신부 경로*

### 메인 (앞서 합의한 구조)
3. **홈** — 위치 목록(카드에 아이템 수 / '곧 만료' 뱃지) + 맨 위 '전체' 진입
4. **위치 상세** — 해당 위치 아이템 목록 + 추가 버튼
5. **전체** — 모든 아이템(위치 뱃지) + 검색 / **유통기한 임박순 정렬**

> 시안 파일: `inventory_app_screens.html` (① 로그인 + ② 가구 설정)

---

## 5. 당시 미결이었던 것 — 전부 결정·완료됨

> 현재 작업 목록은 [`TODO.md`](TODO.md). 아래는 기록용 결말.

- [x] **초대코드 정책**: ⓐ 가구당 상시 코드 1개 + 재발급. 6자 영숫자(혼동 글자 제외), `max_members`(기본 4) 합류 시점 체크
- [x] 초대코드 발급/공유 화면 + **카카오톡 공유**(딥링크 `/join?code=` 자동입력 합류까지)
- [x] 앱 이름 확정: **곳간**
- [x] SSE → **드롭** (refetch-on-focus + optimistic + pull-to-refresh로 충분)
- [x] DB 스키마 확정([`db/SCHEMA.md`](db/SCHEMA.md)) → 백엔드·프론트 완성 → **운영 배포 (2026-06-04)**

---

*가계부앱 관련 논의는 이 문서 범위 밖(별도 진행).*
