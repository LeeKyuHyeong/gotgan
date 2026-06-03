package com.kh.stock.item.dto;

import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

/** 수량 증감(+/-). 결과가 음수면 거부. 0 이면 의미 없음. */
public record AdjustQuantityRequest(
        @NotNull BigDecimal delta
) {}
