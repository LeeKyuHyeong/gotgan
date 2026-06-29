# 곳간 — 작업 현황 (TODO)

> 가족(부부) 단위 집안 재고 확인 모바일 웹앱 — **운영 가동 중**: https://gotgan.kyuhyeong.com (2026-06-04~)
> 스택: React+TS+Tailwind(프론트, 5173) / Spring Boot 4·Java 17(백엔드, 8083) / MariaDB(local 3306, 운영 3312)
> 설계 결정·문서 지도: [`README.md`](README.md) · DB: [`db/SCHEMA.md`](db/SCHEMA.md) · 인프라 SSOT: `D:\server-infra.md`

---

## 🔜 남은 작업

### 🧪 엣지케이스 테스트 목록 — 가구(household) 흐름 중심

> 범례: `[x]` = 테스트 이미 존재 / `[ ]` = 작성 필요 · `(BE)` 백엔드 · `(FE)` 프론트
> 기존 커버리지: `HouseholdServiceJoinTest`, `HouseholdServiceInviteTest`, `TenantInterceptorTest`(BE), `lib/household.test.ts`(FE)

#### 1. 카카오 로그인 → 온보딩 진입 (`/api/auth/kakao`, `/api/me`, LoginPage·KakaoCallbackPage·App 가드)
- [ ] (BE) 가구 0개 사용자 로그인 → `needsOnboarding=true` + `households=[]` 반환
- [ ] (BE) 가구 1개 이상 사용자 → `needsOnboarding=false` (항상 `households.isEmpty()`와 일치 보장)
- [ ] (BE) 카카오 토큰 교환 실패(KOE010 등) → 401 + 원인 메시지 노출(만료 아님, 인터셉터가 안 가로챔)
- [ ] (FE) silent 로그인(`prompt=none`) 실패 → `skipSilentLogin()` 세팅, 무한 재인가 루프 없음
- [ ] (FE) 로그인 직후 401/네트워크 에러 → 60초 내 silent 재시도 금지(스로틀)
- [ ] (FE) StrictMode 이중 마운트 시 같은 `code` 중복 교환 안 함
- [ ] (FE) 콜백 `code` 누락 → 에러 화면(흰 화면 X)
- [ ] (FE) 콜백 `error`+`error_description` 동시 노출(취소/거부 사유 표시) ⚠️ 현재 `error`만 표시
- [ ] (FE) `needsOnboarding=true`인데 캐시상 가구 존재 → 온보딩 갇힘/깜빡임 없이 `/`로 정정
- [ ] (FE) 카카오 닉네임 미동의(표시명 null) → 온보딩에서 표시명 먼저 강제 입력

#### 2. 가구 생성 (`POST /api/households`, CreateHouseholdPage)
- [ ] (BE) 이름 공백/null/공백만 → 400(@NotBlank), 50자 초과 → 거부
- [ ] (BE) 생성 시 OWNER 멤버십 + 기본 위치 4개 + 초대코드가 한 트랜잭션으로 원자적 저장(중간 실패 시 전부 롤백)
- [ ] (BE) 초대코드 생성 충돌 시 재시도 후 유니크 코드 확정(do-while에 최대 시도 한도 ⚠️ 무한루프 방지)
- [ ] (BE) 표시명 없는 사용자가 곧바로 생성 호출 → 표시명 강제(또는 명확한 거부)
- [ ] (FE) 생성 직후 `householdId` 자동 설정 + `/households/{id}/invite` 이동
- [ ] (FE) 생성 후 뒤로가기로 온보딩 복귀 시 상태 불일치(이미 가구 있음) 없음
- [ ] (BE) (정책 결정 필요) 한 사용자의 가구 생성 개수 상한 ⚠️ 현재 무제한

#### 3. 초대코드 발급/재발급 (`POST /api/households/{id}/invite/regenerate`, InvitePage)
- [x] (BE) 코드 형식: 6자, 혼동 글자(I·O·L·0·1) 제외, `SecureRandom`
- [x] (BE) 동시 재발급으로 코드 충돌 → `DataIntegrityViolationException` → 409 변환(`saveAndFlush`)
- [ ] (BE) 가족장(OWNER)만 재발급 가능, MEMBER → 403
- [ ] (BE) 재발급 시 이전 코드 즉시 무효화 여부 결정 ⚠️ 현재 영구 유효(이전 링크 계속 합류 가능)
- [ ] (BE) 코드 만료(TTL) 정책 결정/테스트 ⚠️ 현재 만료 없음
- [ ] (FE) 6자/허용 글자 입력 검증(maxLength·정규식) — 잘못된 코드 즉시 차단
- [ ] (FE) 409 수신 시 사용자 안내(자동 또는 수동 재시도)

#### 4. 가구 합류 (`POST /api/households/join`, JoinHouseholdPage, `/join?code=`)
- [x] (BE) 정원(maxMembers=4) 초과 → 409, 멤버십 미생성(`never().save()`)
- [x] (BE) 비관락(`findByInviteCodeForUpdate`)으로 동시 합류 직렬화
- [x] (BE) 코드 정규화(소문자·공백 trim+upper) 후 조회
- [x] (BE) 존재하지 않는 코드 → 404
- [x] (BE) 이미 멤버인 사용자 재합류 → 멱등(기존 가구 반환, 중복 멤버십 X)
- [ ] (BE) 동시 N명 합류로 정원 경합 — UNIQUE(user_id, household_id) 위반 없이 정확히 정원까지만 성공(멀티스레드 시뮬레이션)
- [ ] (BE) 신규 합류자 role = MEMBER 고정
- [ ] (FE) 표시명 없는 사용자 합류 → 표시명 저장 후 합류, 표시명 저장만 성공/합류 실패 시 재시도 일관성
- [x] (FE) `/join?code=XXX` 딥링크 → 코드 자동 입력 + 1회 소비(`clearPendingInviteCode`) — `household.test.ts`
- [ ] (FE) 정원 초과(409) 후 멤버 이탈로 빈자리 생기면 재시도 가능

#### 5. 가구 관리 — 이름변경·내보내기·이양·나가기·삭제 (HouseholdManagePage)
- [ ] (BE) 이름변경: OWNER만, trim·50자 제한
- [ ] (BE) 멤버 내보내기: OWNER만, 자기 자신 내보내기 불가, 없는 멤버 → 404
- [ ] (BE) 소유권 이양: OWNER만, 자신에게 이양 불가, 대상이 현재 멤버여야 함, 이양 후 역할 스왑(OWNER↔MEMBER)
- [ ] (BE) 나가기: OWNER는 불가(먼저 이양 필요), MEMBER는 가능
- [ ] (BE) 가구 삭제: OWNER만, cascade 순서(이력→재고→상품→그룹→위치→분류요청→멤버십→가구)로 FK 위반 없이 전체 정리
- [ ] (BE) 삭제 후 잔존 데이터 0건 검증(가구 스코프 전 테이블)
- [ ] (FE) 내보내기/이양/삭제 후 `/api/me` 및 가구 캐시 무효화 → 화면 정합
- [ ] (FE) 내보내진 멤버가 해당 가구로 요청 시 403 → 가구 선택/온보딩으로 자동 복귀

#### 6. 테넌트 격리 (`X-Household-Id`, TenantInterceptor·TenantContext)
- [x] (BE) 헤더 없음 → 통과(/api/me·온보딩 등)
- [x] (BE) 헤더 비숫자 → 400
- [x] (BE) 미인증 + 헤더 → 401
- [x] (BE) 멤버 아닌 가구 id → 403, TenantContext 미설정
- [x] (BE) 멤버인 가구 → TenantContext 설정, afterCompletion에서 clear
- [ ] (BE) 요청 처리 중 예외 발생 시에도 ThreadLocal 정리(thread pool 재사용 시 이전 householdId 누수 없음) ⚠️
- [ ] (BE) 가구 스코프 엔드포인트를 헤더 없이 호출 → `TenantContext.require()`가 명확한 에러 반환
- [ ] (BE) A가구 멤버가 헤더로 B가구 id 위조 → 403(데이터 누출 없음) — 핵심 멀티테넌트 회귀 가드
- [ ] (BE) 가구 전환 후 직전 가구 데이터가 응답에 섞이지 않음(서비스 계층 household_id 직접 필터 검증)

---

#### 우선순위 메모
- **High**: 정원 동시 경합(4-6), cascade 삭제 정합(5), 타가구 id 위조 차단(6), needsOnboarding 일관성(1)
- **Medium**: ThreadLocal 예외 누수(6), 초대코드 만료/무효화 정책(3), 표시명 저장-합류 부분실패(4)
- **Low**: 프론트 코드 형식 검증(3), error_description 노출(1), 가구 생성 개수 상한(2)
