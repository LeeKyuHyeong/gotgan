package com.kh.stock.stock.dto;

import com.kh.stock.domain.ProductGroup;

public record ProductGroupResponse(Long id, String name) {
    public static ProductGroupResponse from(ProductGroup g) {
        return new ProductGroupResponse(g.getId(), g.getName());
    }
}
