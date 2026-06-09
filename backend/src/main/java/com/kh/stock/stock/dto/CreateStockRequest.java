package com.kh.stock.stock.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

/** 재고 추가: productId(기존 선택) XOR newProduct(새 품목). 서비스에서 정확히 하나 검증. */
public record CreateStockRequest(
        Long productId,
        @Valid NewProductInput newProduct,
        @NotNull Long locationId,
        @NotNull @DecimalMin("0") BigDecimal quantity,
        LocalDate expiryDate,
        @Size(max = 255) String memo
) {}
