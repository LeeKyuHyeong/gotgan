# 곳간 — 프론트엔드

React 19 + TypeScript + Vite + Tailwind v4 + React Query v5. 모바일 우선 SPA.
전체 문서는 [루트 README](../README.md) 참고.

```bash
npm install
npm run dev     # 5173 — /api 는 vite.config.ts 프록시로 8083 백엔드 연결
npm run build   # 운영 빌드 — .env.production(커밋됨, 공개 키) 자동 로드. CI가 이걸로 배포
```

## env 파일
| 파일 | 용도 | 커밋 |
|---|---|---|
| `.env.local` | 로컬 카카오 앱(kh_stock_local) 키 | ❌ |
| `.env.production` | 운영 카카오 앱(kh_stock) **공개 키** (REST/JS) | ✅ |

키 없이도 로그인 화면의 **개발용 로그인**으로 전체 기능 테스트 가능.

## 구조 메모
- `src/api/` — axios 클라이언트(JWT + `X-Household-Id` 헤더) + React Query 훅(`queries.ts`)
- `src/lib/auth.ts` — localStorage 키: `stock.token` / `stock.householdId` / `stock.pendingInviteCode`(초대 딥링크 1회용)
- `src/lib/kakao.ts` — 카카오 JS SDK 로더 + 초대 공유(미설정 시 Web Share→복사 폴백)
- 라우팅(`App.tsx`): `/join`(공개, 초대 딥링크) → `RequireAuth` → `RequireHousehold` → 탭 화면들
