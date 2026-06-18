# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# 곳간(gotgan) — 우리집 재고 관리 앱

가족(부부) 단위 집안 재고 확인 모바일 웹앱. 운영: https://gotgan.kyuhyeong.com
설계 결정·문서 지도는 [`README.md`](README.md), 작업 현황은 [`TODO.md`](TODO.md), DB 스키마는 [`db/SCHEMA.md`](db/SCHEMA.md) 참고.

## 명령어

```bash
# 백엔드 (Spring Boot 4 · Java 17 · 8083) — Windows는 gradlew.bat
cd backend && ./gradlew bootRun        # Flyway가 스키마 자동 적용
./gradlew build                        # 빌드 + 전체 테스트
./gradlew test                         # 테스트만 (DB 필요 — local 3306)
./gradlew test --tests 'com.kh.stock.SomeTest'   # 단일 테스트 클래스
./gradlew test --tests '*.SomeTest.someMethod'   # 단일 메서드

# 프론트엔드 (Vite + React 19 + TS · 5173)
cd frontend && npm install
npm run dev          # /api → 8083 프록시 (vite.config.ts)
npm run build        # tsc -b && vite build
npm run lint         # eslint
npm test             # vitest run
npm test -- household # 단일 파일 (현재 lib/household.test.ts만 존재)
```

- 카카오 키 없이도 로그인 화면의 **개발용 로그인**(dev 프로파일 전용, `DevAuthController`)으로 테스트 가능. 어드민은 `"admin":true`.
- 로컬 카카오 실로그인은 Client Secret **필수**: `export KAKAO_CLIENT_SECRET=<값>` 후 bootRun (없으면 KOE010). PowerShell은 `$env:KAKAO_CLIENT_SECRET='...'`.
- 백엔드 코드 변경 후 8083 재시작 필요. 프론트 `.env.local` 변경 시 dev 서버 재시작.
- 테스트 현황: 백엔드는 `contextLoads`만(비즈니스 테스트 미작성), 프론트는 `lib/household.test.ts`만.

## 아키텍처

### 멀티테넌트 격리 (★ 가장 중요 — 버그의 99%가 여기서)

가구(household) 단위 멀티테넌트. **공통 모듈 추출 없이 서비스 계층에서 수동 격리** (Hibernate `@Filter` 미채택). 요청 흐름:

1. `JwtAuthenticationFilter` — `Authorization: Bearer <jwt>`에서 userId 파싱, DB에서 user/role을 **live 해석**(삭제·강등 즉시 반영, JWT claim 신뢰 안 함).
2. `TenantInterceptor` — `X-Household-Id` 헤더가 있으면 해당 사용자의 `membership` 존재를 **검증**(없으면 403) 후 `TenantContext`(ThreadLocal)에 세팅. 헤더 없으면 비움(/api/me·온보딩 등).
3. 가구 범위 서비스는 `TenantContext.require()`로 현재 가구를 받아 **모든 쿼리에 `household_id`를 직접 필터링**. 단건은 `requireOwned*`로 소유·소프트삭제까지 검증.
4. 수량 증감·합류 경합은 비관락(`findByIdForUpdate`)으로 lost-update·정원 초과 방지.

> **새 쿼리/엔티티 추가 시 `household_id` 필터를 반드시 직접 챙길 것** (stock/product/product_group/storage_location 전부). 프론트 React Query 캐시 키에도 가구 ID를 포함해 가구 전환 시 stale 데이터가 새지 않게 한다.

### 품목 3계층 (V6 정규화)

`product_group`(선택, 합산 묶음 예: 맥주=캔+병) → `product`(품목 정의: 이름·단위·분류) → `stock`(실제 재고 묶음: 위치·수량·유통기한). 전부 `household_id` 보유 + 소프트삭제(`deleted_at`). 구 `item` 테이블은 V8에서 `item_legacy`로 백업 rename(미사용). API: `/api/inventory`(트리), `/api/stock`(재고 묶음), `/api/products`, `/api/product-groups`. `InventoryService`→`InventoryAssembler`가 활성 묶음을 그룹/품목 합산 트리로 조립.

### 권한 — role 두 종류 분리

- `app_user.role` = **USER / SYSTEM_ADMIN** — 플랫폼 권한(어드민 웹 `/api/admin/**`, 분류 승인·공통분류 CRUD). 운영자 부여는 운영 DB `UPDATE app_user SET role='SYSTEM_ADMIN'` 후 재로그인(role이 인증 필터에서 live 해석).
- `membership.role` = **OWNER / MEMBER** — 가구 내 권한(초대·멤버 관리·가구 삭제는 OWNER만). 권한 매트릭스는 `db/SCHEMA.md §5`.

### 인증 (카카오 OAuth + 자체 JWT)

카카오 소셜 로그인 단독(ID/PW 없음). 프론트 콜백(`/oauth/kakao/callback`) → `AuthController`가 카카오 토큰 교환(`KakaoOAuthClient`) → 자체 JWT 발급(운영 TTL 30일). 표시명(닉네임)은 카카오 동의항목 대신 직접 입력. 무클릭 자동 로그인(`prompt=none`).
- `/api/auth/**`의 401은 "교환 실패"지 만료가 아님 → 프론트 인터셉터가 가로채지 않음(콜백 화면이 KOE010 등 원인 표시). 그 외 401만 로그아웃.
- 보안: STATELESS, 401(미인증)/403(권한부족) 명시 구분, `/error`·`/actuator/health`·`/api/auth/**` permitAll, CORS는 운영에서 localhost면 기동 실패.

### Web Push (곧만료 알림)

표준 VAPID. `ExpiryPushScheduler`가 매일 9시(KST) 가구별 D-3(`expiry_date BETWEEN 오늘 AND 오늘+3`) 요약 발송, 410 응답 구독은 자동 정리. **컨테이너 TZ=Asia/Seoul 필수**. 곧만료는 컬럼이 아니라 쿼리 계산. 인앱 브라우저는 푸시 API 미지원 → 크롬 1회 ON.

### 프론트엔드

`api/client.ts` axios 인스턴스가 요청마다 토큰 + `X-Household-Id` 자동 첨부. 데이터는 React Query v5(refetch-on-focus + optimistic update + pull-to-refresh로 "열 때 항상 최신" — SSE/WebSocket 드롭). PWA(`sw.js`·manifest) + 푸시 토글. 자주 쓰는 품목 프리셋 198개(`lib/presets.ts`).

### 스키마 소유 — Flyway

`backend/src/main/resources/db/migration`(V1~V9 SQL) + V7만 Java 마이그레이션(`backend/src/main/java/db/migration`). JPA는 `ddl-auto: validate`(검증만). DB charset **utf8mb4**(이모지 저장 필수). enum은 `@Enumerated(STRING)`, 연관은 전부 LAZY + `open-in-view: false`. 패키지/DB명은 `stock`(rename 비용 커서 유지), 서비스명만 `gotgan`.

## 서버 인프라 (SSOT 참조)

- **서버/배포 인프라 SSOT: `D:\server-infra.md`** (로컬 전용, git 미추적 — 리포·운영서버에 없음).
- 포트·도메인·방화벽·컨테이너 TZ 규칙(`Asia/Seoul` 의무)·배포 반영 매트릭스·트러블슈팅·gotgan 고유 운영 메모(카카오 앱 2원 구성, `.env.prod` 유일본, Web Push 디버깅)는 전부 그 문서 참조.
- **인프라(compose/nginx/포트/배포) 변경 시 `D:\server-infra.md`를 함께 최신화할 것.**
- 배포: `main` 푸시 → GitHub Actions가 빌드 검증 후 서버 SSH 자동 배포.

## 비밀 관리

- 커밋 금지: `.env.prod`(서버 전용·untracked), `frontend/.env.local`.
- 커밋 OK: `frontend/.env.production` — `VITE_*`는 브라우저 노출되는 **공개 키**.
- 진짜 비밀은 `KAKAO_CLIENT_SECRET` · `JWT_SECRET` · `VAPID_PRIVATE_KEY` · DB 비번뿐 — env로만 주입.
