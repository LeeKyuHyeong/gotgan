package com.kh.stock.stock.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

/** 묶음 편집(PATCH) — 단순 갱신. 자동 합치기 없음(스펙). */
public record UpdateStockRequest(
        @NotNull @DecimalMin("0") BigDecimal quantity,
        LocalDate expiryDate,
        @Size(max = 255) String memo,
        @NotNull Long locationId
) {}
