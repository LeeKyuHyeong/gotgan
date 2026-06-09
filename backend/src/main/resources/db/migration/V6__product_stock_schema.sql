-- 품목/재고 정규화 — 신규 3계층 스키마 (Flyway V6, 스키마 변경만)
-- 설계: docs/superpowers/specs/2026-06-09-product-stock-normalization-design.md
-- MariaDB / InnoDB / utf8mb4. 멀티테넌트: household_id 격리.

CREATE TABLE product_group (
  id           BIGINT      NOT NULL AUTO_INCREMENT,
  household_id BIGINT      NOT NULL,
  name         VARCHAR(50) NOT NULL,
  sort_order   INT         NOT NULL DEFAULT 0,
  deleted_at   DATETIME    NULL,
  created_at   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_group_name (household_id, name),
  KEY idx_group_active (household_id, deleted_at),
  CONSTRAINT fk_group_household FOREIGN KEY (household_id) REFERENCES household (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE product (
  id               BIGINT       NOT NULL AUTO_INCREMENT,
  household_id     BIGINT       NOT NULL,
  product_group_id BIGINT       NULL,
  category_id      BIGINT       NULL,
  name             VARCHAR(100) NOT NULL,
  unit             VARCHAR(20)  NULL,
  sort_order       INT          NOT NULL DEFAULT 0,
  deleted_at       DATETIME     NULL,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_product_name (household_id, name),
  KEY idx_product_active (household_id, deleted_at),
  KEY idx_product_group (product_group_id),
  CONSTRAINT fk_product_household FOREIGN KEY (household_id)     REFERENCES household (id) ON DELETE CASCADE,
  CONSTRAINT fk_product_group     FOREIGN KEY (product_group_id) REFERENCES product_group (id),
  CONSTRAINT fk_product_category  FOREIGN KEY (category_id)      REFERENCES category (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE stock (
  id           BIGINT        NOT NULL AUTO_INCREMENT,
  household_id BIGINT        NOT NULL,
  product_id   BIGINT        NOT NULL,
  location_id  BIGINT        NOT NULL,
  quantity     DECIMAL(10,2) NOT NULL DEFAULT 1,
  expiry_date  DATE          NULL,
  memo         VARCHAR(255)  NULL,
  deleted_at   DATETIME      NULL,
  created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_stock_active (household_id, deleted_at),
  KEY idx_stock_location (location_id, deleted_at),
  KEY idx_stock_expiry (household_id, expiry_date),
  KEY idx_stock_product (product_id),
  CONSTRAINT fk_stock_household FOREIGN KEY (household_id) REFERENCES household (id) ON DELETE CASCADE,
  CONSTRAINT fk_stock_product   FOREIGN KEY (product_id)  REFERENCES product (id),
  CONSTRAINT fk_stock_location  FOREIGN KEY (location_id) REFERENCES storage_location (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- V7(Java)가 stock.id를 역참조 기록하는 임시 컬럼. V8 이후에도 롤백 안전망으로 보존.
ALTER TABLE item ADD COLUMN migrated_stock_id BIGINT NULL;
