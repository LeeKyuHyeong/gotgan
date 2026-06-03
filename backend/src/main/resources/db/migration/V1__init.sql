-- 우리집 재고 — 초기 스키마 (Flyway V1)
-- 원본 설계: db/01_schema.sql, db/SCHEMA.md
-- MariaDB / InnoDB / utf8mb4. 멀티테넌트: household_id 격리.

CREATE TABLE app_user (
  id                BIGINT       NOT NULL AUTO_INCREMENT,
  kakao_id          VARCHAR(64)  NOT NULL,
  nickname          VARCHAR(50)  NULL,
  profile_image_url VARCHAR(500) NULL,
  role              VARCHAR(20)  NOT NULL DEFAULT 'USER',
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_kakao (kakao_id),
  CONSTRAINT ck_user_role CHECK (role IN ('USER','SYSTEM_ADMIN'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE household (
  id            BIGINT      NOT NULL AUTO_INCREMENT,
  name          VARCHAR(50) NOT NULL,
  owner_user_id BIGINT      NOT NULL,
  invite_code   VARCHAR(8)  NOT NULL,
  max_members   INT         NOT NULL DEFAULT 4,
  created_at    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_household_invite (invite_code),
  KEY idx_household_owner (owner_user_id),
  CONSTRAINT fk_household_owner FOREIGN KEY (owner_user_id) REFERENCES app_user (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CREATE TABLE storage_location (
  id           BIGINT      NOT NULL AUTO_INCREMENT,
  household_id BIGINT      NOT NULL,
  name         VARCHAR(50) NOT NULL,
  emoji        VARCHAR(16) NULL,
  sort_order   INT         NOT NULL DEFAULT 0,
  created_at   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_location_household (household_id, sort_order),
  CONSTRAINT fk_location_household FOREIGN KEY (household_id) REFERENCES household (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE category (
  id         BIGINT      NOT NULL AUTO_INCREMENT,
  name       VARCHAR(40) NOT NULL,
  emoji      VARCHAR(16) NULL,
  sort_order INT         NOT NULL DEFAULT 0,
  status     VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_category_name (name),
  CONSTRAINT ck_category_status CHECK (status IN ('ACTIVE','HIDDEN'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE category_request (
  id                   BIGINT      NOT NULL AUTO_INCREMENT,
  requested_name       VARCHAR(40) NOT NULL,
  suggested_emoji      VARCHAR(16) NULL,
  household_id         BIGINT      NOT NULL,
  requested_by_user_id BIGINT      NOT NULL,
  status               VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  resolved_category_id BIGINT      NULL,
  resolved_by_user_id  BIGINT      NULL,
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

CREATE TABLE item (
  id           BIGINT        NOT NULL AUTO_INCREMENT,
  household_id BIGINT        NOT NULL,
  location_id  BIGINT        NOT NULL,
  category_id  BIGINT        NULL,
  name         VARCHAR(100)  NOT NULL,
  quantity     DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit         VARCHAR(20)   NULL,
  expiry_date  DATE          NULL,
  memo         VARCHAR(255)  NULL,
  deleted_at   DATETIME      NULL,
  created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_item_household (household_id),
  KEY idx_item_location (location_id),
  KEY idx_item_expiry (household_id, expiry_date),
  KEY idx_item_active (household_id, deleted_at),
  CONSTRAINT fk_item_household FOREIGN KEY (household_id) REFERENCES household (id) ON DELETE CASCADE,
  CONSTRAINT fk_item_location  FOREIGN KEY (location_id)  REFERENCES storage_location (id),
  CONSTRAINT fk_item_category  FOREIGN KEY (category_id)  REFERENCES category (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
