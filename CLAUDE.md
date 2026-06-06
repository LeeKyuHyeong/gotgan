# CLAUDE.md — 곳간(gotgan)

> 우리집 재고 관리 앱 (운영: https://gotgan.kyuhyeong.com). 설계 결정·문서 지도는 [`README.md`](README.md), 작업 현황은 [`TODO.md`](TODO.md) 참고. (초기 설계 문서 `stock.md`는 2026-06-06 폐지 — README로 이관)

## 서버 인프라 (SSOT 참조)

- **서버/배포 인프라 SSOT: `D:\server-infra.md`** (로컬 전용, git 미추적 — 리포·운영서버에 없음)
- 포트·도메인·방화벽·컨테이너 TZ 규칙(`Asia/Seoul` 의무)·배포 반영 매트릭스(푸시 시 서버 자동/수동 반영 범위)·트러블슈팅·gotgan 고유 운영 메모(카카오 앱 2원 구성, `.env.prod` 유일본, Web Push 디버깅)는 전부 그 문서 참조.
- 리포별 `server-infra-*.md`는 폐지됨(2026-06-06, `server-infra-stock.md` 삭제). **인프라(compose/nginx/포트/배포) 변경 시 `D:\server-infra.md`를 함께 최신화할 것.**
