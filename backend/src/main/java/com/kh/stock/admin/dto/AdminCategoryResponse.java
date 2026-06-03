package com.kh.stock.admin.dto;

import com.kh.stock.domain.Category;
import com.kh.stock.domain.type.CategoryStatus;

/** 어드민 공통 분류 마스터 항목(시안 ⑭). 숨김 포함 전체. */
public record AdminCategoryResponse(
        Long id,
        String name,
        String emoji,
        String color,
        int sortOrder,
        CategoryStatus status
) {
    public static AdminCategoryResponse from(Category c) {
        return new AdminCategoryResponse(c.getId(), c.getName(), c.getEmoji(), c.getColor(), c.getSortOrder(), c.getStatus());
    }
}
