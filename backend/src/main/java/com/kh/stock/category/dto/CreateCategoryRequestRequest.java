package com.kh.stock.category.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 분류 추가 요청 생성 — 원하는 분류명 + (선택) 추천 이모지. */
public record CreateCategoryRequestRequest(
        @NotBlank @Size(max = 40) String name,
        @Size(max = 16) String emoji
) {}
