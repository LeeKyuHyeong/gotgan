package com.kh.stock.stock.dto;

import java.math.BigDecimal;
import java.util.List;

/** 전체 보기: 그룹(소속 품목+묶음) + 그룹 없는 단독 품목. 그룹/단독 간 정렬 병합은 프론트. */
public record InventoryResponse(
        List<Group> groups,
        List<Product> ungrouped
) {
    /** 그룹 합산 행. totalQuantity=소속 품목 합, minDDay=가장 임박(null=만료없음만). */
    public record Group(
            Long groupId,
            String groupName,
            BigDecimal totalQuantity,
            Long minDDay,
            boolean expiringSoon,
            List<Product> products
    ) {}

    /** 품목 합산 행 + 펼침 묶음. */
    public record Product(
            Long productId,
            String name,
            String unit,
            Long categoryId,
            String categoryName,
            String categoryEmoji,
            String categoryColor,
            BigDecimal totalQuantity,
            Long minDDay,
            boolean expiringSoon,
            List<StockResponse> batches
    ) {}
}
