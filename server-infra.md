# 곳간 — 운영 인프라 SSOT

> 배포 구성·절차의 단일 출처. 앱 설계는 [`stock.md`](stock.md), 남은 작업은 [`TODO.md`](TODO.md) 참고.

## 확정 값
| 항목 | 값 |
|---|---|
| 서버 | Cafe24 단일 호스트 `175.125.21.245` |
| 도메인 | `gotgan.kyuhyeong.com` (앱 이름 '곳간' 확정) |
| 앱 포트 | **8083** (호스트 `127.0.0.1` 에만 바인딩, nginx가 프록시) |
| DB 포트 | **3312**(호스트, DBeaver 외부접속 전용) → 컨테이너 내부 3306 |
| 앱→DB 접속 | 컨테이너명 **`stock-db:3306`** (3312 아님) |
| DB명 / charset | `stock` / utf8mb4 (unicode_ci) |
| 관리 IP (방화벽 `stock_db` 허용) | `125.131.87.14`, `121.165.29.66`, `14.47.28.75` |

## 카카오 앱 구성 (로컬/운영 분리)
| | 로컬 `kh_stock_local` | 운영 `kh_stock` |
|---|---|---|
| REST API 키 | `865af4cbbc46547691915a3aed45ec79` (application.yml 기본값) | `94ec6009e0bea91aa7510478c762083d` |
| JavaScript 키 (카톡 공유) | `frontend/.env.local` | `91fc022753da03ec6be3ea90fef6db99` |
| Redirect URI | `http://localhost:5173/oauth/kakao/callback` | `https://gotgan.kyuhyeong.com/oauth/kakao/callback` |
| 플랫폼 > Web 도메인 | `http://localhost:5173` | `https://gotgan.kyuhyeong.com` |
| 키 주입 위치 | `frontend/.env.local`(미커밋) | `frontend/.env.production`(커밋, CI 빌드가 사용) + 서버 `.env.prod`(REST키/Client Secret) |

- REST/JS 키는 **공개 키**(브라우저 노출 전제) — 커밋 OK. **Client Secret·Admin 키만 비밀**(`.env.prod` env 주입, 커밋 금지).
- 주의: `application.yml`의 REST키 기본값은 **로컬 앱** 키 — 운영은 `.env.prod`의 `KAKAO_REST_API_KEY`가 반드시 override 해야 함(설정됨).

## 아키텍처
```
브라우저 ──https──▶ 호스트 nginx (443, certbot)
                      ├─ /            → /var/www/gotgan (프론트 SPA dist, try_files → index.html)
                      └─ /api/        → http://127.0.0.1:8083  (docker: stock-app)
                                              │
                                              └─ jdbc → stock-db:3306 (docker: MariaDB)
DBeaver(관리 IP만) ──tcp 3312──▶ stock-db
```
- 프론트(Vite SPA)와 백엔드(Spring Boot)는 **동일 오리진**(nginx가 SPA 서빙 + `/api` 프록시) → axios `baseURL='/'` 그대로, CORS는 사실상 same-origin.
- 앱은 루프백에만 노출되어 외부에서 8083 직접 접근 불가.

## 이 저장소에 준비된 파일 (코드로 완료)
| 파일 | 역할 |
|---|---|
| `backend/Dockerfile` | 멀티스테이지(Gradle 9.5.1 빌드 → JRE17 런타임), 비루트 실행 |
| `backend/.dockerignore` | 빌드 컨텍스트 축소 |
| `docker-compose.prod.yml` | `stock-db`(MariaDB) + `stock-app`. 앱 `127.0.0.1:8083`, DB `3312:3306`, healthcheck, 볼륨 |
| `.env.prod.example` | 운영 환경변수 템플릿 (실제 `.env.prod`는 `.gitignore`) |
| `.gitignore` | `.env.prod`/`.env.local` 등 비밀 보호 |
| `deploy/nginx/gotgan.kyuhyeong.com.conf` | 80 블록(certbot이 443 자동 추가), SPA + `/api` 프록시 |
| `frontend/.env.production.example` | 프론트 빌드용 카카오 키 템플릿 |
| `application.yml` | `KAKAO_CLIENT_SECRET` 평문 제거 → env 주입. REST키/JWT/CORS/redirect 모두 env override 가능 |

## 배포 절차 (git 기반)
- 리포: `https://github.com/LeeKyuHyeong/gotgan.git` (서버 경로 `/root/gotgan`)
- **비밀(`.env.prod`)은 git에 없음**(gitignore) → 로컬에서 서버로 scp 1회 전송. 프론트 공개키(`frontend/.env.production`)는 리포에 포함.
- 사전: Docker/compose/nginx/certbot 설치(완료), DNS A `gotgan.kyuhyeong.com`→`175.125.21.245`(완료).

```bash
# 1) 코드 클론 (서버, root)
#  공개 리포면 그대로. 비공개면 deploy key 먼저(아래 '비공개 리포 인증' 참고) 후 SSH URL 사용.
git clone https://github.com/LeeKyuHyeong/gotgan.git /root/gotgan
cd /root/gotgan

# 2) 운영 비밀 전송 (로컬 PC에서 1회)
#  scp D:\stock\.env.prod root@175.125.21.245:/root/gotgan/.env.prod

# 3) 백엔드 + DB 기동 (Flyway가 스키마+공통분류 시드+V3 색상 자동 적용)
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
docker compose -f docker-compose.prod.yml logs -f stock-app    # "Started StockApplication" + Flyway V1~V3 확인

# 4) 프론트 빌드 → nginx 루트로 배포
#  (A) 서버에 Node 20+ 있으면:
cd /root/gotgan/frontend && npm ci && npm run build
sudo mkdir -p /var/www/gotgan && sudo cp -r dist/* /var/www/gotgan/
#  (B) 서버에 Node 없으면: 로컬에서 npm run build 후 dist 만 전송
#  scp -r D:\stock\frontend\dist\* root@175.125.21.245:/tmp/dist/ ; 서버에서 sudo cp -r /tmp/dist/* /var/www/gotgan/

# 5) nginx 사이트 등록 (80 블록 먼저)
sudo cp /root/gotgan/deploy/nginx/gotgan.kyuhyeong.com.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/gotgan.kyuhyeong.com.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx        # 80 정상 응답 확인

# 6) HTTPS (443·인증서·80→443 리다이렉트 자동)
sudo certbot --nginx -d gotgan.kyuhyeong.com
```

### 비공개 리포 인증 (deploy key, 서버에서 1회)
```bash
ssh-keygen -t ed25519 -f ~/.ssh/gotgan_deploy -N ""    # 키 생성
cat ~/.ssh/gotgan_deploy.pub                            # → GitHub 리포 Settings > Deploy keys 에 등록(read-only)
cat >> ~/.ssh/config <<'EOF'
Host github-gotgan
  HostName github.com
  User git
  IdentityFile ~/.ssh/gotgan_deploy
EOF
git clone github-gotgan:LeeKyuHyeong/gotgan.git /root/gotgan   # SSH URL 로 클론
```

### 업데이트 배포 — CI/CD 자동화 (`.github/workflows/deploy.yml`)
`main` 푸시(또는 Actions 수동 실행) → 러너에서 백엔드 bootJar·프론트 빌드(CI 게이트) → 서버 SSH로:
프론트 `dist`를 `/var/www/gotgan`에 전송, 백엔드는 `git reset --hard origin/main` + `docker compose up -d --build`.
- **전제(1회 부트스트랩)**: 서버에 `/root/gotgan` 클론 + `.env.prod` 존재 + nginx/certbot 설정 완료. CD는 *코드 업데이트*만 담당(nginx/cert 설정은 1회 수동).
- **필요 시크릿**(GitHub 리포 Settings > Secrets and variables > Actions):
  - `SERVER_SSH_KEY` — 배포용 SSH 개인키(아래 생성), `SERVER_HOST`=`175.125.21.245`, `SERVER_USER`=`root`
  - 시크릿 없으면 워크플로는 빌드 검증만 하고 배포 단계는 스킵(초록).
- **배포 키 생성(서버에서 1회)** — 개인키는 외부 노출 없이 서버에서 만들어 GitHub Secret에만 붙여넣기:
  ```bash
  ssh-keygen -t ed25519 -f ~/.ssh/gotgan_ci -N "" -C "github-actions"
  cat ~/.ssh/gotgan_ci.pub >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys
  cat ~/.ssh/gotgan_ci   # 전체(-----BEGIN~END-----)를 SERVER_SSH_KEY 시크릿에 붙여넣기
  ```

### 수동 업데이트 (CI/CD 없이, 폴백)
```bash
cd /root/gotgan && git pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
cd frontend && npm run build && cp -r dist/* /var/www/gotgan/
```

## 외부 콘솔/방화벽 수동 작업 — ✅ 전부 완료 (2026-06-04, 운영 가동 중)
- [x] **DNS**: `gotgan.kyuhyeong.com` A레코드 → `175.125.21.245`
- [x] **Cafe24 방화벽**: `stock_db` 규칙에 관리 IP 3개만 3312 허용 (DBeaver 접속 확인됨)
- [x] **카카오 콘솔**: 운영 전용 앱 `kh_stock` 신규 생성 — Redirect URI + Web 도메인 등록 (위 '카카오 앱 구성' 표)
- [x] **`.env.prod` 실제 비밀 주입** (JWT_SECRET / DB 비번 / 운영 앱 Client Secret)
- [x] **certbot** 실행 — HTTPS 가동
- (해소) 평문 노출됐던 Client Secret은 **로컬 앱**(kh_stock_local) 것 — 운영은 별도 앱이라 영향 없음. 로컬 앱 시크릿 재발급은 선택.

## 운영 수칙 (실수 방지 — 이 세션에서 배운 것)
1. **서버에서 직접 수정해도 되는 파일은 untracked `.env.prod` 하나뿐.**
   추적 파일(소스, `frontend/.env.production` 등)을 서버에서 고쳐도 ① 프론트는 GitHub Actions 러너에서 빌드되므로 효과 없음 ② 다음 배포의 `git reset --hard origin/main`에 덮어써짐.
2. **MariaDB `MARIADB_*` env는 볼륨 최초 생성 시에만 적용.** 이후 `.env.prod` 비번을 바꿔도 실제 DB 비번은 안 바뀜.
   비번 불일치 시: SQL로 `ALTER USER` 하거나, 데이터 포기 가능하면 `docker compose -f docker-compose.prod.yml --env-file .env.prod down -v && ... up -d --build` 로 재초기화(스키마는 앱 기동 시 Flyway가 재생성).
3. **DB 재초기화(또는 데이터 삭제) 후엔 사용자 브라우저의 localStorage가 유령 데이터가 됨**(`stock.token`, `stock.householdId`) — '불러오는 중' 멈춤의 원인. 프론트에 에러 화면+로그아웃 탈출구 있음(`LoadErrorScreen`).
4. **Windows에서 만든 실행 스크립트는 exec bit 누락**(CI `Permission denied`) → `git update-index --chmod=+x <file>` 후 커밋.
5. DBeaver 운영 접속: `175.125.21.245:3312`, user `root`, 비번은 `.env.prod`의 `DB_ROOT_PASSWORD`(볼륨 init 시점 값).

## TODO 5번 매핑 — ✅ 완료 (배포 가동 중)
- [x] 시크릿 환경변수 분리 (application.yml `KAKAO_CLIENT_SECRET` 등 env화)
- [x] `docker-compose.prod.yml` + `.env.prod`(템플릿/gitignore) — 앱 `127.0.0.1:8083`, DB `stock-db:3306`
- [x] nginx conf (80 블록 → certbot 443 자동)
- [x] 운영 redirect/CORS 를 env로 주입 가능하게 (`KAKAO_REDIRECT_URI`, `CORS_ORIGINS`)
- [x] **(서버/콘솔 작업)** DNS·방화벽·카카오 콘솔 등록·certbot 실행·실제 비밀 주입 — 위 체크리스트
- [ ] (선택) Hibernate `@Filter` 자동 테넌트 격리 하드닝 — 현재 서비스 계층 수동 격리

## 비밀 관리 원칙
- 커밋 금지: `.env.prod`(서버 전용), `frontend/.env.local`(`.gitignore` 등록됨).
- `frontend/.env.production`은 **커밋 대상** — `VITE_*` 값(카카오 REST/JS 키)은 브라우저에 노출되는 공개 키라 시크릿이 아니고, CI가 이 파일로 운영 빌드함.
- Client Secret·JWT_SECRET·DB 비번만 진짜 비밀 — `.env.prod` env 주입 전용.
