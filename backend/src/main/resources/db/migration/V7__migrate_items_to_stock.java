package db.migration;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;

import java.sql.PreparedStatement;
import java.sql.Statement;
import java.sql.Timestamp;
import java.util.List;
import java.util.Map;

/**
 * 기존 item → product/stock 이관. 그룹핑 키 = (household_id, name)로 product 유니크와 일치
 * (운영 실측상 (household_id, name) 중복 0건). unit/category는 그룹의 첫 행 값.
 * 그룹의 모든 원본 item이 소프트삭제면 product.deleted_at도 설정(cascade 불변식 보존).
 * item_history 재배선은 V8에서(FK 제약 때문에).
 */
public class V7__migrate_items_to_stock extends BaseJavaMigration {

    @Override
    public void migrate(Context context) {
        JdbcTemplate jdbc = new JdbcTemplate(
                new SingleConnectionDataSource(context.getConnection(), true));

        List<Map<String, Object>> items = jdbc.queryForList("""
                select id, household_id, location_id, category_id, name, quantity, unit,
                       expiry_date, memo, deleted_at
                from item
                order by household_id, name, id
                """);

        // 1) (household_id, name) → product_id (생성/재사용). 첫 행 unit/category 사용.
        record ProdKey(long household, String name) {}
        java.util.Map<ProdKey, Long> productIds = new java.util.HashMap<>();
        // 그룹의 모든 행 소프트삭제 여부 추적
        java.util.Map<ProdKey, Boolean> allDeleted = new java.util.HashMap<>();
        java.util.Map<ProdKey, Timestamp> anyDeletedAt = new java.util.HashMap<>();

        for (Map<String, Object> it : items) {
            long household = ((Number) it.get("household_id")).longValue();
            String name = (String) it.get("name");
            ProdKey key = new ProdKey(household, name);
            Timestamp deletedAt = (Timestamp) it.get("deleted_at");
            allDeleted.merge(key, deletedAt != null, (a, b) -> a && b);
            if (deletedAt != null) anyDeletedAt.putIfAbsent(key, deletedAt);

            if (!productIds.containsKey(key)) {
                Long categoryId = it.get("category_id") == null ? null
                        : ((Number) it.get("category_id")).longValue();
                String unit = (String) it.get("unit");
                KeyHolder kh = new GeneratedKeyHolder();
                jdbc.update(con -> {
                    PreparedStatement ps = con.prepareStatement("""
                            insert into product (household_id, product_group_id, category_id, name, unit, sort_order)
                            values (?, NULL, ?, ?, ?, 0)
                            """, Statement.RETURN_GENERATED_KEYS);
                    ps.setLong(1, household);
                    if (categoryId == null) ps.setNull(2, java.sql.Types.BIGINT); else ps.setLong(2, categoryId);
                    ps.setString(3, name);
                    if (unit == null) ps.setNull(4, java.sql.Types.VARCHAR); else ps.setString(4, unit);
                    return ps;
                }, kh);
                productIds.put(key, kh.getKey().longValue());
            }
        }

        // 2) 각 item → stock, item.migrated_stock_id 기록
        for (Map<String, Object> it : items) {
            long itemId = ((Number) it.get("id")).longValue();
            long household = ((Number) it.get("household_id")).longValue();
            String name = (String) it.get("name");
            long productId = productIds.get(new ProdKey(household, name));
            Long locationId = ((Number) it.get("location_id")).longValue();
            Timestamp deletedAt = (Timestamp) it.get("deleted_at");

            KeyHolder kh = new GeneratedKeyHolder();
            jdbc.update(con -> {
                PreparedStatement ps = con.prepareStatement("""
                        insert into stock (household_id, product_id, location_id, quantity, expiry_date, memo, deleted_at)
                        values (?, ?, ?, ?, ?, ?, ?)
                        """, Statement.RETURN_GENERATED_KEYS);
                ps.setLong(1, household);
                ps.setLong(2, productId);
                ps.setLong(3, locationId);
                ps.setBigDecimal(4, (java.math.BigDecimal) it.get("quantity"));
                Object expiry = it.get("expiry_date");
                if (expiry == null) ps.setNull(5, java.sql.Types.DATE);
                else ps.setDate(5, java.sql.Date.valueOf(expiry.toString()));
                String memo = (String) it.get("memo");
                if (memo == null) ps.setNull(6, java.sql.Types.VARCHAR); else ps.setString(6, memo);
                if (deletedAt == null) ps.setNull(7, java.sql.Types.TIMESTAMP); else ps.setTimestamp(7, deletedAt);
                return ps;
            }, kh);
            long stockId = kh.getKey().longValue();
            jdbc.update("update item set migrated_stock_id = ? where id = ?", stockId, itemId);
        }

        // 3) 그룹의 모든 행이 소프트삭제면 product.deleted_at 설정
        for (var e : allDeleted.entrySet()) {
            if (Boolean.TRUE.equals(e.getValue())) {
                Long pid = productIds.get(e.getKey());
                jdbc.update("update product set deleted_at = ? where id = ?",
                        anyDeletedAt.get(e.getKey()), pid);
            }
        }

        // 4) 검증
        Long itemCount = jdbc.queryForObject("select count(*) from item", Long.class);
        Long stockCount = jdbc.queryForObject("select count(*) from stock", Long.class);
        if (!itemCount.equals(stockCount)) {
            throw new IllegalStateException("이관 검증 실패: item=" + itemCount + " stock=" + stockCount);
        }
        Long unmapped = jdbc.queryForObject(
                "select count(*) from item where migrated_stock_id is null", Long.class);
        if (unmapped != 0) {
            throw new IllegalStateException("이관 검증 실패: migrated_stock_id 미기록 " + unmapped + "건");
        }
        java.math.BigDecimal itemSum = jdbc.queryForObject("select coalesce(sum(quantity),0) from item", java.math.BigDecimal.class);
        java.math.BigDecimal stockSum = jdbc.queryForObject("select coalesce(sum(quantity),0) from stock", java.math.BigDecimal.class);
        if (itemSum.compareTo(stockSum) != 0) {
            throw new IllegalStateException("이관 검증 실패: 수량 합 item=" + itemSum + " stock=" + stockSum);
        }
    }
}
