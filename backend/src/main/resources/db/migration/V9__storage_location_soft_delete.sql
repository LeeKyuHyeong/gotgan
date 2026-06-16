-- 위치 소프트삭제 — stock.location_id FK(RESTRICT) 때문에, 소프트삭제된 재고가 남은 위치를
-- 하드삭제하면 FK 위반(500)이 났다. 위치도 deleted_at 으로 소프트삭제해 해당 행을 보존한다.
ALTER TABLE storage_location ADD COLUMN deleted_at DATETIME NULL;

-- 가구별 활성 위치 조회용(목록/홈). 위치 수는 적지만 패턴 일관성 + 정렬 스캔 절약.
CREATE INDEX idx_location_active ON storage_location (household_id, deleted_at);
