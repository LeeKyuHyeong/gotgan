-- Web Push 구독 (브라우저/기기 단위, 사용자 소속).
-- endpoint 가 구독의 정체성(기기+브라우저별 유일) — 재구독 시 upsert.
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
