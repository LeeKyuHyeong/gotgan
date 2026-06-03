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
- 리포: `https://github.com/LeeKyuHyeong/gotgan.git` (서버 경로 `/opt/gotgan`)
- **비밀(`.env.prod`)은 git에 없음**(gitignore) → 로컬에서 서버로 scp 1회 전송. 프론트 공개키(`frontend/.env.production`)는 리포에 포함.
- 사전: Docker/compose/nginx/certbot 설치(완료), DNS A `gotgan.kyuhyeong.com`→`175.125.21.245`(완료).

```bash
# 1) 코드 클론 (서버, root)
#  공개 리포면 그대로. 비공개면 deploy key 먼저(아래 '비공개 리포 인증' 참고) 후 SSH URL 사용.
git clone https://github.com/LeeKyuHyeong/gotgan.git /opt/gotgan
cd /opt/gotgan

# 2) 운영 비밀 전송 (로컬 PC에서 1회)
#  scp D:\stock\.env.prod root@175.125.21.245:/opt/gotgan/.env.prod

# 3) 백엔드 + DB 기동 (Flyway가 스키마+공통분류 시드+V3 색상 자동 적용)
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
docker compose -f docker-compose.prod.yml logs -f stock-app    # "Started StockApplication" + Flyway V1~V3 확인

# 4) 프론트 빌드 → nginx 루트로 배포
#  (A) 서버에 Node 20+ 있으면:
cd /opt/gotgan/frontend && npm ci && npm run build
sudo mkdir -p /var/www/gotgan && sudo cp -r dist/* /var/www/gotgan/
#  (B) 서버에 Node 없으면: 로컬에서 npm run build 후 dist 만 전송
#  scp -r D:\stock\frontend\dist\* root@175.125.21.245:/tmp/dist/ ; 서버에서 sudo cp -r /tmp/dist/* /var/www/gotgan/

# 5) nginx 사이트 등록 (80 블록 먼저)
sudo cp /opt/gotgan/deploy/nginx/gotgan.kyuhyeong.com.conf /etc/nginx/sites-available/
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
git clone github-gotgan:LeeKyuHyeong/gotgan.git /opt/gotgan   # SSH URL 로 클론
```

### 업데이트 배포 (이후)
```bash
cd /opt/gotgan && git pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build         # 백엔드
cd frontend && npm run build && sudo cp -r dist/* /var/www/gotgan/                    # 프론트(또는 로컬빌드+scp)
# .env.prod 가 바뀐 경우에만 다시 scp
```

## 외부 콘솔/방화벽 수동 작업 (코드로 불가 — 직접 처리 필요)
- [ ] **DNS**: `gotgan.kyuhyeong.com` A레코드 → `175.125.21.245`
- [ ] **Cafe24 방화벽**: `stock_db` 규칙에 관리 IP 3개만 3312 허용. 8083은 외부 차단(루프백 바인딩으로 이미 안전하나 규칙으로도 명시).
- [ ] **카카오 콘솔**:
  - 카카오 로그인 > Redirect URI 에 `https://gotgan.kyuhyeong.com/oauth/kakao/callback` 추가 (현재 `localhost:5173`만)
  - 플랫폼 > Web > 사이트 도메인에 `https://gotgan.kyuhyeong.com` 등록 (JS SDK 공유 동작 조건)
- [ ] **JWT_SECRET / DB 비번 / 카카오 시크릿**을 `.env.prod` 에 실제 값으로 채움
- [ ] (권장) 평문 노출됐던 카카오 **Client Secret 재발급**(로테이션) — 기존 값이 application.yml 평문이었음

## TODO 5번 매핑
- [x] 시크릿 환경변수 분리 (application.yml `KAKAO_CLIENT_SECRET` 등 env화)
- [x] `docker-compose.prod.yml` + `.env.prod`(템플릿/gitignore) — 앱 `127.0.0.1:8083`, DB `stock-db:3306`
- [x] nginx conf (80 블록 → certbot 443 자동)
- [x] 운영 redirect/CORS 를 env로 주입 가능하게 (`KAKAO_REDIRECT_URI`, `CORS_ORIGINS`)
- [ ] **(서버/콘솔 작업)** DNS·방화벽·카카오 콘솔 등록·certbot 실행·실제 비밀 주입 — 위 체크리스트
- [ ] (선택) Hibernate `@Filter` 자동 테넌트 격리 하드닝 — 현재 서비스 계층 수동 격리

## 비밀 관리 원칙
- `.env.prod`, `frontend/.env.production`(실제), `.env.local` 은 커밋 금지(`.gitignore` 등록됨).
- `VITE_*` 값(카카오 REST/JS 키)은 브라우저에 노출되는 **공개 키** — 시크릿 아님. Client Secret·JWT_SECRET·DB 비번만 진짜 비밀.
