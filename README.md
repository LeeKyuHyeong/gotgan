# 곳간 (gotgan) — 우리집 재고

> 가족(부부) 단위 **집안 재고 확인** 모바일 웹앱. 운영: **https://gotgan.kyuhyeong.com**
> 카카오 로그인 → 가구(household) 단위로 위치·아이템·유통기한·변동이력을 같이 관리.
> **PWA**(홈 화면에 추가 = 앱 설치) + **곧만료 Web Push**(매일 9시 D-3 요약) + 무클릭 자동 로그인.

## 문서 지도

| 문서 | 내용 |
|---|---|
| [`TODO.md`](TODO.md) | 작업 현황 — 남은 작업 + 완료 이력 |
| `D:\server-infra.md` | **운영 인프라 SSOT**(로컬 전용, git 미추적) — 서버/포트/배포 절차/CI/CD/카카오 앱 구성/운영 수칙 |
| [`db/SCHEMA.md`](db/SCHEMA.md) | DB 스키마(8테이블) 설계. 실제 스키마는 Flyway(`backend/.../db/migration`)가 소유 |
| [`inventory_app_screens.html`](inventory_app_screens.html) | 초기 화면 시안(14화면) |

> 초기 설계 문서 `stock.md`는 전 항목 결정·구현 완료로 폐지(2026-06-06). 핵심 결정은 아래 표로 이관.

## 설계 결정 (확정, 기록용)

| 항목 | 결정 | 이유 |
|---|---|---|
| 멀티테넌트 | **가구(household) 단위** | 가계부앱 family-unit 구조 재사용. 모든 조회 `X-Household-Id` + `household_id` 필터 |
| 인증 | **카카오 소셜 로그인 단독** | ID/PW·아이디/비번 찾기·이메일 인증 전부 제거 — 신원관리는 카카오가 담당 |
| 과금 | **전부 무료** | 재고앱엔 유료화 포인트가 없음 |
| 실시간 | **"열 때 항상 최신"** | SSE/WebSocket 드롭 — refetch on focus + optimistic update + pull-to-refresh로 충분 |
| 3D 표시 | **제외** | 위치를 공간이 아닌 '분류(필터)'로 처리. 집 모델링 비용 대비 가치 낮음 |
| 위치 계층 | **v1은 평평하게(1단계)** | 큰방>옷장>서랍 계층은 필요해지면 v2 |
| 공통 멀티테넌트 모듈 | **추출 안 함** | 앱 2개(가계부+재고)일 땐 복사가 정답 — 3번째 앱 나오면 재검토 |
| 아이템 사진 첨부 | **안 함 (2026-06-06 확정)** | 업로드·저장소·썸네일 인프라 대비 가치 낮음. 텍스트+이모지로 충분 |

## 스택 & 구조

```
frontend/   React 19 + TS + Vite + Tailwind v4 + React Query v5   (dev 5173)
backend/    Spring Boot 4 + Java 17, 카카오 OAuth + 자체 JWT, Flyway  (8083)
db/         스키마 참조용 SQL (실행 주체는 Flyway)
deploy/     nginx 사이트 설정
```

- 멀티테넌트: 모든 조회 `X-Household-Id` 헤더 + `household_id` 필터
- DB: MariaDB — 로컬 3306, 운영 3312(외부 관리용)→컨테이너 3306, DB명 `stock`, utf8mb4

## 로컬 개발

```bash
# DB: 로컬 MariaDB 3306에 stock DB (db/00_setup.sql 참고)
cd backend && ./gradlew bootRun        # 8083, Flyway가 스키마 자동 적용
cd frontend && npm install && npm run dev   # 5173, /api → 8083 프록시
```

카카오 키 없이도 로그인 화면의 **개발용 로그인**으로 테스트 가능.
카카오 실로그인은 `frontend/.env.local`에 `VITE_KAKAO_REST_API_KEY`(로컬 앱 kh_stock_local) 설정.

## 배포

`main` 푸시 → GitHub Actions가 빌드 검증 후 서버 SSH 배포 (자동).
절차·시크릿·1회 부트스트랩은 `D:\server-infra.md` 참고.

## 비밀 관리 (요약)

- 커밋 금지: `.env.prod`(서버 전용·untracked), `frontend/.env.local`
- 커밋 OK: `frontend/.env.production` — `VITE_*`는 브라우저 노출되는 **공개 키**
- 진짜 비밀은 `KAKAO_CLIENT_SECRET` · `JWT_SECRET` · DB 비번뿐 — env로만 주입
