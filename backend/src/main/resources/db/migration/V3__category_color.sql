-- 분류 색상 (Flyway V3). hex #rrggbb, NULL 허용(미지정 시 기본 회색 톤으로 표시).
ALTER TABLE category ADD COLUMN color VARCHAR(7) NULL AFTER emoji;

-- 시드 분류 기본 색 백필 (즉시 보이도록). 이후 운영자가 어드민에서 변경 가능.
UPDATE category SET color = '#6aa8e0' WHERE name = '유제품';
UPDATE category SET color = '#5bb381' WHERE name = '신선식품';
UPDATE category SET color = '#6fbf5b' WHERE name = '채소';
UPDATE category SET color = '#e0584f' WHERE name = '과일';
UPDATE category SET color = '#c95c6e' WHERE name = '육류';
UPDATE category SET color = '#5bbfd4' WHERE name = '냉동식품';
UPDATE category SET color = '#e08a3f' WHERE name = '음료';
UPDATE category SET color = '#c79a5b' WHERE name = '간식';
UPDATE category SET color = '#b0823f' WHERE name = '양념';
UPDATE category SET color = '#8f86d8' WHERE name = '생필품';
UPDATE category SET color = '#4fb6c0' WHERE name = '위생용품';
UPDATE category SET color = '#d65d8f' WHERE name = '의약품';
UPDATE category SET color = '#d255a0' WHERE name = '화장품';
UPDATE category SET color = '#a98c4a' WHERE name = '주방용품';
UPDATE category SET color = '#8a8a8a' WHERE name = '기타';
