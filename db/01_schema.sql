-- ============================================================
-- 우리집 재고 — 스키마 (V1)
-- MariaDB 10.6+ / InnoDB / utf8mb4
-- 멀티테넌트 단위: household (가구). 가구 범위 테이블은 전부 household_id 보유.
-- enum은 이식성/JPA 편의를 위해 VARCHAR + CHECK 로 표현.
-- ============================================================

USE stock;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS item_history;
DROP TABLE IF EXISTS item;
DROP TABLE IF EXISTS category_request;
DROP TABLE IF EXISTS category;
DROP TABLE IF EXISTS storage_location;
DROP TABLE IF EXISTS membership;
DROP TABLE IF EXISTS household;
DROP TABLE IF EXISTS app_user;
SET FOREIGN_KEY_CHECKS = 1;

-- ------------------------------------------------------------
-- 사용자 (카카오 로그인 단독). 전역(가구에 속하지 않음).
-- role: USER(일반) / SYSTEM_ADMIN(플랫폼 운영자 = 어드민 웹 접근)
-- 주의: 여기서 USER role 은 "플랫폼 권한"이고, '가족장'은 membership.role 임.
-- ------------------------------------------------------------
CREATE TABLE app_user (
  id                BIGINT       NOT NULL AUTO_INCREMENT,
  kakao_id          VARCHAR(64)  NOT NULL,                 -- 카카오 회원번호
  nickname          VARCHAR(50)  NULL,
  profile_image_url VARCHAR(500) NULL,
  role              VARCHAR(20)  NOT NULL DEFAULT 'USER',
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_kakao (kakao_id),
  CONSTRAINT ck_user_role CHECK (role IN ('USER','SYSTEM_ADMIN'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 가구 (테넌트 단위)
-- owner_user_id = 가족장. invite_code = 상시 1개(재발급 시 덮어씀, 결정 ⓐ).
-- max_members = 합류 시점에 체크하는 인원 상한.
-- ------------------------------------------------------------
CREATE TABLE household (
  id            BIGINT      NOT NULL AUTO_INCREMENT,
  name          VARCHAR(50) NOT NULL,
  owner_user_id BIGINT      NOT NULL,
  invite_code   VARCHAR(8)  NOT NULL,                      -- 6~8자 영숫자(헷갈리는 글자 제외)
  max_members   INT         NOT NULL DEFAULT 4,
  created_at    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_household_invite (invite_code),            -- 코드로 가구 유일 식별
  KEY idx_household_owner (owner_user_id),
  CONSTRAINT fk_household_owner FOREIGN KEY (owner_user_id) REFERENCES app_user (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 멤버십 (user <-> household). role: OWNER(가족장) / MEMBER
-- 한 user 가 같은 household 에 중복 가입 불가.
-- ------------------------------------------------------------
CREATE TABLE membership (
  id           BIGINT      NOT NULL AUTO_INCREMENT,
  user_id      BIGINT      NOT NULL,
  household_id BIGINT      NOT NULL,
  role         VARCHAR(20) NOT NULL DEFAULT 'MEMBER',
  joined_at    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_membership (user_id, household_id),
  KEY idx_membership_household (household_id),
  CONSTRAINT fk_membership_user      FOREIGN KEY (user_id)      REFERENCES app_user (id),
  CONSTRAINT fk_membership_household FOREIGN KEY (household_id) REFERENCES household (id) ON DELETE CASCADE,
  CONSTRAINT ck_membership_role CHECK (role IN ('OWNER','MEMBER'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 보관 위치 (가구 범위). 이모지 직접 선택 / 순서 변경 가능 (결정 3).
-- ------------------------------------------------------------
CREATE TABLE storage_location (
  id           BIGINT      NOT NULL AUTO_INCREMENT,
  household_id BIGINT      NOT NULL,
  name         VARCHAR(50) NOT NULL,
  emoji        VARCHAR(16) NULL,                           -- 예: 🧊 🚿 🏠
  sort_order   INT         NOT NULL DEFAULT 0,
  created_at   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_location_household (household_id, sort_order),
  CONSTRAINT fk_location_household FOREIGN KEY (household_id) REFERENCES household (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 분류 (전역 공통 목록). 운영자(어드민)가 관리. 이모지 보유 (결정 2).
-- 가구별 커스텀이 아니라 모든 가구가 공유하는 마스터 목록.
-- status: ACTIVE(노출) / HIDDEN(숨김, 기존 데이터 보존)
-- ------------------------------------------------------------
CREATE TABLE category (
  id         BIGINT      NOT NULL AUTO_INCREMENT,
  name       VARCHAR(40) NOT NULL,
  emoji      VARCHAR(16) NULL,
  color      VARCHAR(7)  NULL,                            -- 분류 색상 #rrggbb
  sort_order INT         NOT NULL DEFAULT 0,
  status     VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_category_name (name),
  CONSTRAINT ck_category_status CHECK (status IN ('ACTIVE','HIDDEN'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 분류 추가 요청 (커뮤니티 → 운영자 승인 흐름).
-- 승인되면 category 로 반영되고 resolved_category_id 로 연결.
-- ------------------------------------------------------------
CREATE TABLE category_request (
  id                   BIGINT      NOT NULL AUTO_INCREMENT,
  requested_name       VARCHAR(40) NOT NULL,
  suggested_emoji      VARCHAR(16) NULL,
  household_id         BIGINT      NOT NULL,               -- 요청한 가구
  requested_by_user_id BIGINT      NOT NULL,               -- 요청자
  status               VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  resolved_category_id BIGINT      NULL,                   -- 승인 시 생성/연결된 분류
  resolved_by_user_id  BIGINT      NULL,                   -- 처리한 운영자
  resolved_at          DATETIME    NULL,
  created_at           DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_catreq_status (status, created_at),
  KEY idx_catreq_household (household_id),
  CONSTRAINT fk_catreq_household FOREIGN KEY (household_id)         REFERENCES household (id) ON DELETE CASCADE,
  CONSTRAINT fk_catreq_user      FOREIGN KEY (requested_by_user_id) REFERENCES app_user (id),
  CONSTRAINT fk_catreq_category  FOREIGN KEY (resolved_category_id) REFERENCES category (id),
  CONSTRAINT fk_catreq_resolver  FOREIGN KEY (resolved_by_user_id)  REFERENCES app_user (id),
  CONSTRAINT ck_catreq_status CHECK (status IN ('PENDING','APPROVED','REJECTED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 아이템 (가구 범위). 위치 1개(FK), 분류 1개(전역 FK, NULL=미분류).
-- quantity DECIMAL: 0.5 통 같은 소수 단위 허용.
-- 소프트 삭제(deleted_at): 변동 이력의 item_id 가 항상 유효하도록 보존.
-- ------------------------------------------------------------
CREATE TABLE item (
  id           BIGINT        NOT NULL AUTO_INCREMENT,
  household_id BIGINT        NOT NULL,
  location_id  BIGINT        NOT NULL,
  category_id  BIGINT        NULL,
  name         VARCHAR(100)  NOT NULL,
  quantity     DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit         VARCHAR(20)   NULL,                         -- 팩, 개, 통, 알 ...
  expiry_date  DATE          NULL,                         -- 곧만료(D-3) 계산은 쿼리에서
  memo         VARCHAR(255)  NULL,
  deleted_at   DATETIME      NULL,
  created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_item_household (household_id),
  KEY idx_item_location (location_id),
  KEY idx_item_expiry (household_id, expiry_date),         -- 임박순 정렬/곧만료 조회
  KEY idx_item_active (household_id, deleted_at),
  CONSTRAINT fk_item_household FOREIGN KEY (household_id) REFERENCES household (id) ON DELETE CASCADE,
  CONSTRAINT fk_item_location  FOREIGN KEY (location_id)  REFERENCES storage_location (id),
  CONSTRAINT fk_item_category  FOREIGN KEY (category_id)  REFERENCES category (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 변동 이력 (누가/언제/무엇을). 2인 사용이라 중요.
-- action: CREATE / INCREASE / DECREASE / UPDATE / DELETE
-- delta = 수량 변화량(+/-), quantity_after = 변경 후 수량.
-- item_name_snapshot = 당시 이름 보존(아이템 변경/삭제돼도 이력 가독성 유지).
-- household_id 비정규화: 가구 단위 이력 조회/격리를 위해.
-- ------------------------------------------------------------
CREATE TABLE item_history (
  id                 BIGINT        NOT NULL AUTO_INCREMENT,
  household_id       BIGINT        NOT NULL,
  item_id            BIGINT        NOT NULL,
  user_id            BIGINT        NOT NULL,
  action             VARCHAR(20)   NOT NULL,
  delta              DECIMAL(10,2) NULL,
  quantity_after     DECIMAL(10,2) NULL,
  item_name_snapshot VARCHAR(100)  NOT NULL,
  created_at         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_history_household (household_id, created_at),
  KEY idx_history_item (item_id),
  CONSTRAINT fk_history_household FOREIGN KEY (household_id) REFERENCES household (id) ON DELETE CASCADE,
  CONSTRAINT fk_history_item      FOREIGN KEY (item_id)      REFERENCES item (id),
  CONSTRAINT fk_history_user      FOREIGN KEY (user_id)      REFERENCES app_user (id),
  CONSTRAINT ck_history_action CHECK (action IN ('CREATE','INCREASE','DECREASE','UPDATE','DELETE'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Web Push 구독 (Flyway V4). 브라우저/기기 단위, 사용자 소속.
-- endpoint 가 구독의 정체성 — 재구독 시 upsert.
-- ------------------------------------------------------------
CREATE TABLE push_subscription (
  id         BIGINT       NOT NULL AUTO_INCREMENT,
  user_id    BIGINT       NOT NULL,
  endpoint   VARCHAR(500) NOT NULL,
  p256dh     VARCHAR(255) NOT NULL,
  auth       VARCHAR(255) NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_push_endpoint (endpoint),
  KEY idx_push_user (user_id),
  CONSTRAINT fk_push_user FOREIGN KEY (user_id) REFERENCES app_user (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
