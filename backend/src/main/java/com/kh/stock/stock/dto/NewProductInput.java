package com.kh.stock.stock.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 새 품목 생성 입력. groupId(기존 그룹) 또는 groupName(새 그룹) 중 하나(optional). */
public record NewProductInput(
        @NotBlank @Size(max = 100) String name,
        @Size(max = 20) String unit,
        Long categoryId,
        Long groupId,
        @Size(max = 50) String groupName
) {}
