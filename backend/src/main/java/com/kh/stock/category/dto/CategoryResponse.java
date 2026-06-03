package com.kh.stock.category.dto;

import com.kh.stock.domain.Category;

public record CategoryResponse(Long id, String name, String emoji, String color) {
    public static CategoryResponse from(Category c) {
        return new CategoryResponse(c.getId(), c.getName(), c.getEmoji(), c.getColor());
    }
}
