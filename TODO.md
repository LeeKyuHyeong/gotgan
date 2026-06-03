# 곳간 — 남은 작업 (TODO)

> 가족(부부) 단위 집안 재고 확인 모바일 웹앱. 설계: [`stock.md`](stock.md) · 시안: [`inventory_app_screens.html`](inventory_app_screens.html) · DB: [`db/SCHEMA.md`](db/SCHEMA.md)
> 스택: React+TS+Tailwind(프론트, 5173) / Spring Boot 4·Java 17(백엔드, 8083) / MariaDB(local 3306, 운영 3312)

---

## ✅ 완료
- 화면 시안 (로그인~어드민 14화면)
- DB 스키마 8테이블 + Flyway 마이그레이션 + 공통분류 시드
- 백엔드: **카카오 로그인 + 자체 JWT**, 테넌트 격리(`X-Household-Id`), 온보딩(가구 생성/합류/초대코드), 위치·아이템·이력·분류 조회 API, 변동이력 자동기록, 소프트삭제, 곧만료 D-3
- 프론트: 로그인(카카오 실로그인 e2e 완료)·온보딩·초대·홈·위치상세·전체/검색·아이템 추가·편집·이력·내정보·**위치 관리/편집**

---

## 🔜 남은 작업

### 1. 분류 추가 요청 (커뮤니티 → 운영자 승인)  ✅ 완료 (2026-06-02)
- [x] **백엔드**: `category_request` API — 요청 생성(`POST /api/category-requests`), 내 가구 요청 조회(`GET`). 중복 PENDING/기존 분류명 409, 미인증 401, 가구헤더 없음 400 — e2e 검증.
- [x] **프론트**: 시안 ⑩ "분류 선택" 오버레이(`CategoryPicker`) — 검색 + 칩 목록 + **"＋ 분류 추가 요청하기"**(이름+이모지) + 요청중 칩. 아이템 폼 분류 필드가 이 오버레이를 염.
- 어드민 승인 측은 → 2번(플랫폼 어드민)에서 처리

### 2. 플랫폼 어드민 (SYSTEM_ADMIN)  ✅ 완료 (2026-06-02)
- [x] **백엔드** `/api/admin/**`(hasRole SYSTEM_ADMIN): `stats`, 요청 목록(`?status=`, 동일이름 `sameNameCount`), 승인(`/approve` — 공통분류 생성/재사용 + 동일이름 대기요청 일괄 승인, 이모지 override), 거절(`/reject`), 공통분류 CRUD(`/categories` GET/POST/PATCH/DELETE). 삭제는 아이템/요청이력 사용 시 409, 숨김은 PATCH status=HIDDEN.
- [x] **프론트**: 내정보→어드민(운영자만 노출). `/admin`(⑬ 요청관리: 통계+카드+이모지지정+승인/반려), `/admin/categories`(⑭ 마스터: 검색+추가/수정/숨김/삭제). 가드 `RequireAdmin`.
- [x] e2e 검증: 권한 403/401/200, 승인→사용자 `/api/categories` 반영, sameNameCount 집계, 각종 가드.
- [x] **보안 버그 수정**: `/error` permitAll + accessDeniedHandler 추가 → 권한거부가 401로 덮이던 문제 해결(프론트 오(誤)로그아웃 방지).
- [x] 운영자 `role=SYSTEM_ADMIN` 부여 = **운영 DB에서 직접 `UPDATE app_user SET role='SYSTEM_ADMIN' WHERE id=?`**. (개발은 `dev-token`에 `"admin":true` — dev 프로파일 전용)

### 3. 가구 관리 잔여 (가족장 권한)  ✅ 완료 (2026-06-02)
- [x] **백엔드**: `GET /api/households/{id}`(상세+멤버, 초대코드는 가족장만), `PATCH`(이름변경), `DELETE`(삭제+아이템/이력/위치/분류요청/멤버십 cascade), `DELETE /members/{userId}`(내보내기), `POST /transfer`(소유권 이양), `POST /leave`(나가기). 가드: 가족장/멤버 권한, 자기 내보내기·가족장 나가기 차단.
- [x] **프론트**: `HouseholdManagePage`(`/households/:id/manage`) — 이름변경·멤버목록·내보내기·가족장 넘기기·삭제(가족장)/나가기(멤버). 내정보 가구행 '관리' 링크(전원).
- [x] e2e 검증: 권한 403/400, 이양 역할swap, cascade 삭제(아이템 보유 상태).

### 4. 마무리/디테일
- [x] **표시명(닉네임) 입력** (2026-06-02) — `PATCH /api/me`. 온보딩: 닉네임 없으면 표시이름부터 입력. 내정보: '이름 수정' 인라인 편집. e2e 검증(200/400/401).
- [ ] 카카오 동의항목(닉네임/프로필) 설정 or 위 입력으로 대체 (위 입력으로 대체 가능 — 동의항목은 선택)
- [x] 초대코드 **카카오톡 공유 버튼** 실제 연동(JS SDK) (2026-06-03) — InvitePage에 '카카오톡으로 초대하기' 버튼. `src/lib/kakao.ts`가 JS SDK(v2.8.1, SRI 핀) 동적로드+`Kakao.Share.sendDefault`(text). 키 미설정 시 Web Share API→복사로 자동 대체. **켜려면**: 카카오 콘솔 JavaScript 키를 `VITE_KAKAO_JS_KEY`에 넣고 플랫폼>Web 도메인 등록(localhost:5173/운영도메인).
- [x] optimistic update / pull-to-refresh 등 UX 다듬기 (2026-06-03)
  - 수량 증감(`useAdjustItem`) **낙관적 갱신**: 클릭 즉시 캐시 반영, 실패 시 inverse-delta 롤백, 연타 중 마지막만 서버 동기화(`isMutating===0`). ItemRow는 0에서 − 비활성화·+는 연타 허용.
  - **당겨서 새로고침**(`PullToRefresh` 컴포넌트) — 홈/전체/위치상세/이력에 적용. window 스크롤 최상단에서만 작동, `overscroll-behavior-y:none`로 브라우저 기본 새로고침 차단. onRefresh=React Query refetch.
- [x] **앱 이름 확정**: **곳간** (2026-06-03) — 도메인 `gotgan.kyuhyeong.com`, index.html 타이틀·로그인 브랜드·카카오/공유 문구 반영.
- [x] **아이템별 변동 이력 보기** (2026-06-03) — `GET /api/items/{id}/history`(소유 검증 후 최신순). 아이템 편집 화면(`ItemFormPage`) 하단에 인라인 표시(액션·누가·델타→결과수량·시각). 공용 헬퍼 `src/lib/history.ts`(ACTION_LABEL/fmtDateTime, HistoryPage와 공유). 훅 `useItemHistory`, 아이템 변경 시 `['itemHistory']` invalidate. 빌드 검증(런타임은 DB 필요).

### 5. 운영/보안 (배포 전)  — 인프라 SSOT: [`server-infra.md`](server-infra.md)
**확정**: 앱 포트 **8083**(회수번호 재사용) · DB **3312** · 도메인 `gotgan.kyuhyeong.com`(앱 이름 '곳간' 확정) · 서버 `175.125.21.245`(Cafe24 단일).
- [x] `application.yml`의 `client-secret` → **환경변수로 분리**(평문 제거, `${KAKAO_CLIENT_SECRET:}`). REST키는 공개값이라 로컬 기본값 유지(env override 가능). (2026-06-03)
- [x] `docker-compose.prod.yml` + `.env.prod.example`(실제 `.env.prod`는 `.gitignore`) — 앱 `127.0.0.1:8083:8083`, DB 컨테이너 `stock-db`(`3312:3306`), 앱→DB는 `stock-db:3306`, healthcheck/볼륨. `backend/Dockerfile`(멀티스테이지·비루트). `compose config`·호스트 `bootJar` 검증 완료(이미지 빌드는 로컬 Docker 데몬 미기동으로 미검증 — 서버에서 확인). (2026-06-03)
- [x] nginx `deploy/nginx/gotgan.kyuhyeong.com.conf`(80블록 → certbot 443 자동) — SPA 정적 + `/api`→`127.0.0.1:8083` 프록시. (2026-06-03)
- [x] CORS/redirect 운영값 **env 주입 가능화**(`CORS_ORIGINS`, `KAKAO_REDIRECT_URI` — `.env.prod`/compose에 반영). (2026-06-03)
- [ ] **(서버/콘솔 작업, 코드 불가)** DNS A레코드 · Cafe24 방화벽 `stock_db`(관리 IP 3개만 3312) · 카카오 콘솔 redirect URI+Web 도메인 등록 · `.env.prod` 실제 비밀 주입 · `certbot --nginx` 실행 → **절차는 [`server-infra.md`](server-infra.md)**
- [ ] (권장) 평문 노출됐던 카카오 **Client Secret 재발급(로테이션)**
- [ ] (선택) Hibernate `@Filter` 자동 테넌트 격리로 하드닝 — 현재는 서비스 계층 수동 격리

### 6. 보류/미정 (stock.md)  — 2026-06-03 정리 완료
- [x] **SSE** → **드롭**. refetch-on-focus + optimistic + pull-to-refresh로 '열 때 항상 최신' 충족, 2인 가구에 서버 복잡도 대비 가치 낮음.
- [ ] 곧만료 **외부 푸시** → **v2 보류**. 실사용 가치 큼. 구현 시 무료 Web Push(FCM/표준, iOS는 PWA 설치) 우선, 카카오 알림톡(유료+승인)은 후순위.
- [x] 분류 **색상 부여** → **지금 구현** (2026-06-03, 아래 7번 참고).
- [ ] 아이템 **사진 첨부** → **v2 보류**. 파일 업로드·저장소·썸네일 인프라 필요. 텍스트+이모지로 v1 충분.

### 7. 분류 색상  ✅ 완료 (2026-06-03)
- [x] **DB**: `category.color VARCHAR(7)`(#rrggbb, nullable) — Flyway `V3__category_color.sql`(컬럼+시드 15개 색 백필). `db/01·02` 참조 스크립트도 동기화.
- [x] **백엔드**: `Category.color` + 응답(`CategoryResponse`/`AdminCategoryResponse`/`ItemResponse.categoryColor`) + 요청(`Create/Update/ApproveRequest`에 `@Pattern ^$|^#[0-9a-fA-F]{6}$`). 빈값=색 제거. 컴파일 검증.
- [x] **프론트**: `src/lib/colors.ts`(팔레트+`tintBg`). 어드민 추가/수정·승인에 색상 피커, ItemRow 아이콘 배경 틴트, CategoryPicker 칩·ItemForm 선택분류 색 점. 빌드 검증.
- [ ] (DB 미가동으로 e2e 미검증) 8083+DB 기동 후 시드 색 표시·어드민 색 변경 반영 확인 필요.

---

## 🧪 알아둘 점
- 로컬 테스트 데이터 존재(유저 현규/예진/outsider, 가구 1, 아이템 등). 정리하려면 `db/` 재적용 또는 `TRUNCATE`.
- 백엔드 코드 변경 후 8083 재시작 필요. 프론트 `.env.local` 변경 시 dev 서버 재시작.
- 테스트 코드: 기본 `contextLoads`만 있음(DB 필요). 비즈니스 로직 테스트 미작성.
