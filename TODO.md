# 곳간 — 작업 현황 (TODO)

> 가족(부부) 단위 집안 재고 확인 모바일 웹앱 — **운영 가동 중**: https://gotgan.kyuhyeong.com (2026-06-04~)
> 스택: React+TS+Tailwind(프론트, 5173) / Spring Boot 4·Java 17(백엔드, 8083) / MariaDB(local 3306, 운영 3312)
> 설계 결정·문서 지도: [`README.md`](README.md) · DB: [`db/SCHEMA.md`](db/SCHEMA.md) · 인프라 SSOT: `D:\server-infra.md`

---

## 🔜 남은 작업

**없음 — 계획한 전 기능 구현·운영 검증 완료 (2026-06-06).** 이후는 운영 유지보수만.

---

## ✅ 완료 이력 (요약 — 상세는 git log)

### 코어 구현 (~2026-06-02)
- DB 스키마 8테이블 + Flyway + 공통분류 시드 / 화면 시안 14화면
- 백엔드: 카카오 로그인+자체 JWT, 테넌트 격리(`X-Household-Id`), 온보딩(가구 생성/합류/초대코드 — 상시 코드 1개+재발급, 6자 영숫자, max_members 4), 위치·아이템·이력·분류 API, 변동이력 자동기록, 소프트삭제, 곧만료 D-3
- 프론트: 로그인·온보딩·초대·홈·위치상세·전체/검색·아이템 추가/편집·이력·내정보·위치 관리
- **분류 추가 요청**(커뮤니티 요청 → 운영자 승인) + **플랫폼 어드민**(SYSTEM_ADMIN — 요청관리·공통분류 마스터 CRUD, `/error` permitAll 보안버그 수정 포함. 운영자 부여는 운영 DB `UPDATE app_user SET role='SYSTEM_ADMIN'`)
- **가구 관리**(이름변경·멤버 내보내기·소유권 이양·나가기·삭제 cascade) / **표시명(닉네임) 입력**(카카오 동의항목 대체)

### 다듬기 (06-03)
- 분류 **색상**(V3 마이그레이션 + 어드민 피커 + ItemRow 틴트) / 아이템별 변동 이력 인라인 표시
- 수량 증감 **낙관적 갱신**(실패 시 inverse-delta 롤백) + **당겨서 새로고침**(홈/전체/위치상세/이력)
- 앱 이름 **곳간** 확정 / 초대코드 **카카오톡 공유**(JS SDK, 미지원 시 Web Share→복사 폴백)
- 배포 준비: client-secret env 분리, compose+Dockerfile(멀티스테이지·비루트), nginx conf, CORS/redirect env화

### 배포·운영 (06-04~06)
- **운영 배포 가동**: HTTPS(certbot)·CI/CD(main 푸시 자동배포)·운영 카카오 앱 `kh_stock`·DBeaver 3312
- 배포 후 안정화: 온보딩 무한루프 수정(`refetchType:'all'`), `/api/me` 실패 시 에러 화면+로그아웃 탈출구
- **카톡 딥링크 합류**: 공유 버튼 → `/join?code=` → 코드 자동입력 원탭 합류 — 실기기 e2e 완료 (4019 트러블슈팅: `D:\server-infra.md`)
- **곧만료 Web Push**(표준 VAPID): `push_subscription`(V4)·스케줄러(9시, 410 자동정리)·`sw.js`·PWA manifest·내정보 알림 토글. 인앱 브라우저는 푸시 API 없음 → 크롬 1회 ON으로 충분
- **세션 유지**: JWT_TTL 30일 + 무클릭 자동 로그인(`prompt=none`, 실패 시 60초 재시도 금지). 인앱 브라우저 localStorage 증발 → PWA 설치 안내가 근본 해법
- 인프라: 컨테이너 TZ=Asia/Seoul 고정, `stock-*`→`gotgan-*` rename, 인프라 문서 `D:\server-infra.md`로 SSOT 일원화
- **자주 쓰는 품목 프리셋**(06-06): 아이템 등록 시 텍스트 입력 유지 + 선택 가능 — 카탈로그 198개(`frontend/src/lib/presets.ts`, 이름·이모지·분류·기본단위), PresetPicker 오버레이(분류별 그룹+검색), 입력 중 실시간 추천 칩(부분일치 8개). 선택 시 분류 자동 매칭 + 단위는 빈 칸일 때만 채움. 공통 분류 **'곡물·면'(🌾) V5 신설**(쌀·면류가 '기타'로 새지 않게, 양념 다음 정렬) — 운영 적용·실기기 확인 완료
- **로그인 401 인터셉터 버그픽스**(06-06): `/api/auth/*`의 401(교환 실패)이 전역 인터셉터에 가로채여 `/login` 강제 이동 → 에러 메시지가 영영 안 보이던 문제. auth 엔드포인트는 통과시켜 콜백 화면이 원인(KOE010 등)을 표시하도록 수정
- **분류 색상 운영 e2e 확인**(06-06): 목록 틴트·폼 색 점·어드민 색 변경 반영 전부 실기기 검증. 이때 **운영 첫 SYSTEM_ADMIN 부여**(규형 id1, 운영 DB UPDATE) — role이 JWT claim에 들어가서 부여 후 재로그인 필요
- **Web Push 운영 수신 확인**(06-06): 매일 9시(KST) 가구별 D-3 요약 수신 확인 완료 — 컨테이너 TZ 고정(`6a3dd86`) 후 정시 발송 동작. 미수신 시 진단: `docker logs gotgan-app | grep 곧만료`

### 드롭/대체 결정 (기록)
- **SSE 드롭** — refetch-on-focus + optimistic + pull-to-refresh로 '열 때 항상 최신' 충족
- **아이템 사진 첨부 드롭**(06-06 확정, 구 v2 보류) — 업로드·저장소·썸네일 인프라 대비 가치 낮음. 텍스트+이모지로 충분
- **Hibernate `@Filter` 하드닝 드롭**(06-06) — 기능 추가 계획이 없어 회귀 방지 실익 없음. 서비스 계층 수동 격리(+`requireOwnedItem` 소유 검증) 유지. 단, **새 쿼리를 추가하게 되면 `household_id` 필터를 반드시 직접 챙길 것**
- **카카오 동의항목(닉네임/프로필)** — 표시명 직접 입력으로 대체, 설정 불필요
- 로컬 앱 client-secret 노출 건 — 운영은 별도 앱(kh_stock)이라 무관, 재발급은 선택
- 초기 설계 문서 `stock.md` 폐지(06-06) — 확정 결정 표는 `README.md`로 이관

---

## 🧪 알아둘 점
- 로컬 테스트 데이터 존재(유저 현규/예진/outsider, 가구 1, 아이템 등). 정리하려면 `db/` 재적용 또는 `TRUNCATE`.
- 백엔드 코드 변경 후 8083 재시작 필요. 프론트 `.env.local` 변경 시 dev 서버 재시작.
- 테스트 코드: 기본 `contextLoads`만 있음(DB 필요). 비즈니스 로직 테스트 미작성.
- 개발용 로그인은 dev 프로파일 전용(`dev-token`, 어드민은 `"admin":true`) — 운영 빌드에서 제거됨.
- **로컬 카카오 실로그인**: 로컬 앱(kh_stock_local)은 Client Secret **필수** — env 없이 백엔드 띄우면 토큰 교환이 KOE010으로 실패. Git Bash에서 `export KAKAO_CLIENT_SECRET=<콘솔 값>` 후 `./gradlew bootRun` (PowerShell은 `$env:KAKAO_CLIENT_SECRET='...'`). secret 불필요한 개발용 로그인이 더 간편.
