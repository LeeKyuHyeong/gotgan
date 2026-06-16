package com.kh.stock.item.dto;

import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

/** 수량 증감(+/-). 결과가 음수면 거부. 0 이면 의미 없음. */
public record AdjustQuantityRequest(
        // DECIMAL(10,2) 범위로 제한 — 초과/과다 소수 입력이 flush 단계 500·반올림으로 합계를 오염시키지 않게.
        @NotNull @Digits(integer = 8, fraction = 2) BigDecimal delta
) {}
