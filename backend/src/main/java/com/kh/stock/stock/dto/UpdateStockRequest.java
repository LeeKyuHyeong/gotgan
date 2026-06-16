package com.kh.stock.stock.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

/** 묶음 편집(PATCH) — 단순 갱신. 자동 합치기 없음(스펙). */
public record UpdateStockRequest(
        // 0 거부(create 와 일관) — "활성 묶음 ⇒ 수량>0" 불변식 유지. 비우려면 삭제/감소를 쓴다.
        @NotNull @DecimalMin(value = "0", inclusive = false) @Digits(integer = 8, fraction = 2) BigDecimal quantity,
        LocalDate expiryDate,
        @Size(max = 255) String memo,
        @NotNull Long locationId
) {}
