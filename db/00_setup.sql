-- ============================================================
-- 우리집 재고 — DB 초기 셋업 (로컬 개발용)
-- MariaDB, 포트 3312 (포트는 서버 my.cnf / 컨테이너 설정에서 지정)
-- 이 파일은 DB/계정을 직접 만들 때 한 번 실행합니다.
-- 운영 DB는 추후 함께 생성.
-- ============================================================

-- 1) 데이터베이스 (이모지 저장을 위해 반드시 utf8mb4)
CREATE DATABASE IF NOT EXISTS stock
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- 2) 애플리케이션 전용 계정 (비밀번호는 로컬에서 바꿔서 사용)
CREATE USER IF NOT EXISTS 'stock_app'@'%' IDENTIFIED BY 'change_me_local';
GRANT ALL PRIVILEGES ON stock.* TO 'stock_app'@'%';
FLUSH PRIVILEGES;

-- 접속 확인용 JDBC URL:
--   jdbc:mariadb://localhost:3312/stock?characterEncoding=utf8mb4&serverTimezone=Asia/Seoul
