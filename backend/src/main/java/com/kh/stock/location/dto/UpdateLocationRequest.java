package com.kh.stock.location.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** sortOrder 가 null 이면 기존 순서 유지. */
public record UpdateLocationRequest(
        @NotBlank @Size(max = 50) String name,
        @Size(max = 16) String emoji,
        Integer sortOrder
) {}
