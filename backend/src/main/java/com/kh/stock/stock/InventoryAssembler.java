package com.kh.stock.stock;

import com.kh.stock.stock.dto.InventoryResponse;
import com.kh.stock.stock.dto.StockResponse;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/** 묶음 평면 목록 + 품목 메타 → 그룹/품목 합산 트리. 순수 함수(DB 비의존).
 *  계약: meta는 batches의 모든 productId를 포함해야 함(누락 시 명확한 예외). */
public final class InventoryAssembler {

    private InventoryAssembler() {}

    /** 품목 메타(그룹·분류). groupId/groupName 둘 다 있으면 그룹 소속. */
    public record ProductMeta(
            Long productId, String name, String unit,
            Long groupId, String groupName,
            Long categoryId, String categoryName, String categoryEmoji, String categoryColor
    ) {}

    public static InventoryResponse assemble(List<StockResponse> batches, Map<Long, ProductMeta> meta) {
        // 1) productId 별 묶음 모으기(입력 순서 = 임박순 유지)
        Map<Long, List<StockResponse>> byProduct = new LinkedHashMap<>();
        for (StockResponse b : batches) {
            byProduct.computeIfAbsent(b.productId(), k -> new ArrayList<>()).add(b);
        }

        // 2) 품목 합산 행 만들기
        Map<Long, InventoryResponse.Product> products = new LinkedHashMap<>();
        for (var e : byProduct.entrySet()) {
            ProductMeta m = Objects.requireNonNull(meta.get(e.getKey()),
                    () -> "missing ProductMeta for productId=" + e.getKey());
            List<StockResponse> bs = e.getValue();
            BigDecimal total = bs.stream().map(StockResponse::quantity)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            Long minDDay = bs.stream().map(StockResponse::dDay)
                    .filter(d -> d != null).min(Comparator.naturalOrder()).orElse(null);
            boolean soon = bs.stream().anyMatch(StockResponse::expiringSoon);
            products.put(e.getKey(), new InventoryResponse.Product(
                    m.productId(), m.name(), m.unit(),
                    m.categoryId(), m.categoryName(), m.categoryEmoji(), m.categoryColor(),
                    total, minDDay, soon, List.copyOf(bs)));
        }

        // 3) 그룹 묶기
        Map<Long, List<InventoryResponse.Product>> byGroup = new LinkedHashMap<>();
        Map<Long, String> groupName = new LinkedHashMap<>();
        List<InventoryResponse.Product> ungrouped = new ArrayList<>();
        for (var e : products.entrySet()) {
            ProductMeta m = Objects.requireNonNull(meta.get(e.getKey()),
                    () -> "missing ProductMeta for productId=" + e.getKey());
            if (m.groupId() != null) {
                byGroup.computeIfAbsent(m.groupId(), k -> new ArrayList<>()).add(e.getValue());
                groupName.putIfAbsent(m.groupId(), m.groupName());
            } else {
                ungrouped.add(e.getValue());
            }
        }

        // 4) 그룹 합산 + 품목 이름순 정렬(스펙: 그룹 내 품목은 이름 오름차순)
        List<InventoryResponse.Group> groups = new ArrayList<>();
        for (var e : byGroup.entrySet()) {
            List<InventoryResponse.Product> ps = e.getValue();
            ps.sort(Comparator.comparing(InventoryResponse.Product::name));
            BigDecimal total = ps.stream().map(InventoryResponse.Product::totalQuantity)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            Long minDDay = ps.stream().map(InventoryResponse.Product::minDDay)
                    .filter(d -> d != null).min(Comparator.naturalOrder()).orElse(null);
            boolean soon = ps.stream().anyMatch(InventoryResponse.Product::expiringSoon);
            groups.add(new InventoryResponse.Group(e.getKey(), groupName.get(e.getKey()),
                    total, minDDay, soon, ps));
        }
        // 그룹/단독 각각 minDDay 임박순(null 뒤) 정렬
        Comparator<Long> dday = Comparator.nullsLast(Comparator.naturalOrder());
        groups.sort(Comparator.comparing(InventoryResponse.Group::minDDay, dday));
        ungrouped.sort(Comparator.comparing(InventoryResponse.Product::minDDay, dday));

        return new InventoryResponse(groups, ungrouped);
    }
}
