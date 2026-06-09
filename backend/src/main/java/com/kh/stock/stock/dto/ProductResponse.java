package com.kh.stock.stock.dto;

import com.kh.stock.domain.Product;

/** 품목 picker 응답. */
public record ProductResponse(
        Long id,
        String name,
        String unit,
        Long groupId,
        String groupName,
        Long categoryId,
        String categoryName
) {
    public static ProductResponse from(Product p) {
        var g = p.getProductGroup();
        var c = p.getCategory();
        return new ProductResponse(
                p.getId(), p.getName(), p.getUnit(),
                g == null ? null : g.getId(),
                g == null ? null : g.getName(),
                c == null ? null : c.getId(),
                c == null ? null : c.getName());
    }
}
