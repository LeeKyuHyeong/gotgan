package com.kh.stock.admin.dto;

import com.kh.stock.domain.type.CategoryStatus;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** 어드민 공통 분류 수정(부분). null 필드는 변경 없음. color는 빈값으로 보내면 색 제거. */
public record UpdateCategoryRequest(
        @Size(max = 40) String name,
        @Size(max = 16) String emoji,
        @Pattern(regexp = "^$|^#[0-9a-fA-F]{6}$", message = "색상은 #rrggbb 형식이어야 합니다.") String color,
        Integer sortOrder,
        CategoryStatus status
) {}
