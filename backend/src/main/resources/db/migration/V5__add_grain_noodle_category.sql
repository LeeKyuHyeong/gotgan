-- 공통 분류 '곡물·면' 추가 (Flyway V5) — 쌀·잡곡·면류·떡국떡 등이 '기타'로 새던 것을 전용 분류로.
-- 양념(9) 다음 자리에 끼워넣기: 생필품(10)~기타(15) 및 운영자 추가 분류를 한 칸 뒤로.
UPDATE category SET sort_order = sort_order + 1 WHERE sort_order >= 10;
INSERT INTO category (name, emoji, color, sort_order) VALUES ('곡물·면', '🌾', '#c2a24f', 10);
