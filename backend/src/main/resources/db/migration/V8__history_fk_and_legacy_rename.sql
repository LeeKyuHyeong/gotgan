-- 이력 FK를 item → stock 으로 재배선 + item → item_legacy 백업 rename.
-- 순서 중요: FK가 item을 가리키는 동안엔 stock.id 로 repoint 불가(FK 위반) → drop 선행.

-- 1) 기존 FK/인덱스 제거
ALTER TABLE item_history DROP FOREIGN KEY fk_history_item;
ALTER TABLE item_history DROP KEY idx_history_item;

-- 2) item_id 값을 매핑된 stock.id 로 repoint
UPDATE item_history h JOIN item i ON h.item_id = i.id
SET h.item_id = i.migrated_stock_id;

-- 3) 컬럼명 변경 item_id → stock_id
ALTER TABLE item_history CHANGE COLUMN item_id stock_id BIGINT NOT NULL;

-- 4) 새 FK + 인덱스
ALTER TABLE item_history ADD CONSTRAINT fk_history_stock FOREIGN KEY (stock_id) REFERENCES stock (id);
ALTER TABLE item_history ADD KEY idx_history_stock (stock_id);

-- 5) item → item_legacy 백업 rename (즉시 드롭 안 함, 롤백 안전망). migrated_stock_id 컬럼 보존.
RENAME TABLE item TO item_legacy;
