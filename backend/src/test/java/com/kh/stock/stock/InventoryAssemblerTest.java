package com.kh.stock.stock;

import com.kh.stock.stock.InventoryAssembler.ProductMeta;
import com.kh.stock.stock.dto.InventoryResponse;
import com.kh.stock.stock.dto.StockResponse;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class InventoryAssemblerTest {

    private final LocalDate today = LocalDate.of(2026, 6, 9);

    private StockResponse batch(long id, long productId, String name, String qty, LocalDate expiry,
                                long locId, String locName) {
        Long dDay = expiry == null ? null : (long) (expiry.toEpochDay() - today.toEpochDay());
        boolean soon = dDay != null && dDay >= 0 && dDay <= 3;
        return new StockResponse(id, productId, name, "개", new BigDecimal(qty), expiry, null,
                locId, locName, null, null, null, null, null, dDay, soon);
    }

    @Test
    void groups_products_sum_quantity_and_min_dday() {
        // 맥주(group 1): 캔(product 10) 냉장고1 + 뒷베란다2, 병(product 11) 냉장고2
        // 우유(product 20, group 없음) 1
        List<StockResponse> batches = List.of(
                batch(1, 10, "맥주 캔", "1", LocalDate.of(2026, 6, 12), 1, "냉장고"),
                batch(2, 10, "맥주 캔", "2", null, 2, "뒷베란다"),
                batch(3, 11, "맥주 병", "2", null, 1, "냉장고"),
                batch(4, 20, "우유", "1", LocalDate.of(2026, 6, 10), 3, "냉장고")
        );
        Map<Long, ProductMeta> meta = Map.of(
                10L, new ProductMeta(10L, "맥주 캔", "개", 1L, "맥주", null, null, null, null),
                11L, new ProductMeta(11L, "맥주 병", "개", 1L, "맥주", null, null, null, null),
                20L, new ProductMeta(20L, "우유", "개", null, null, null, null, null, null)
        );

        InventoryResponse res = InventoryAssembler.assemble(batches, meta);

        assertThat(res.groups()).hasSize(1);
        InventoryResponse.Group beer = res.groups().get(0);
        assertThat(beer.groupId()).isEqualTo(1L);
        assertThat(beer.totalQuantity()).isEqualByComparingTo("5");      // 1+2+2
        assertThat(beer.minDDay()).isEqualTo(3L);                         // 6/12 - 6/9
        assertThat(beer.expiringSoon()).isTrue();
        assertThat(beer.products()).hasSize(2);
        InventoryResponse.Product can = beer.products().get(0);           // 이름순: 맥주 캔
        assertThat(can.totalQuantity()).isEqualByComparingTo("3");
        assertThat(can.batches()).hasSize(2);

        assertThat(res.ungrouped()).hasSize(1);
        InventoryResponse.Product milk = res.ungrouped().get(0);
        assertThat(milk.productId()).isEqualTo(20L);
        assertThat(milk.minDDay()).isEqualTo(1L);
        assertThat(milk.expiringSoon()).isTrue();
        assertThat(milk.totalQuantity()).isEqualByComparingTo("1");
    }

    @Test
    void product_with_only_null_expiry_has_null_minDDay_and_not_soon() {
        List<StockResponse> batches = List.of(batch(1, 30, "휴지", "2", null, 1, "창고"));
        Map<Long, ProductMeta> meta = Map.of(
                30L, new ProductMeta(30L, "휴지", "개", null, null, null, null, null, null));

        InventoryResponse res = InventoryAssembler.assemble(batches, meta);

        assertThat(res.groups()).isEmpty();
        assertThat(res.ungrouped()).hasSize(1);
        assertThat(res.ungrouped().get(0).minDDay()).isNull();
        assertThat(res.ungrouped().get(0).expiringSoon()).isFalse();
    }
}
